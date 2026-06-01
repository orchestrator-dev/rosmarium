import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { logger } from "../../lib/logger.js";
import { MediaTransformOptions } from "./transforms.js";

// Mock local storage paths
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const CACHE_DIR = path.join(process.cwd(), ".cache", "media");

export const processingService = {
  async init() {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
  },

  _getCacheKey(id: string, options: MediaTransformOptions): string {
    const hash = crypto.createHash("md5").update(JSON.stringify(options)).digest("hex");
    return `${id}_${hash}`;
  },

  async processImage(id: string, options: MediaTransformOptions): Promise<{ stream: fs.FileHandle, mime: string, size: number }> {
    await this.init(); // Ensure dirs exist

    const sourcePath = path.join(UPLOADS_DIR, id);
    
    // Check if source file exists
    try {
      await fs.access(sourcePath);
    } catch {
      throw new Error(`Media not found: ${id}`);
    }

    const cacheKey = this._getCacheKey(id, options);
    
    // Determine output format
    let outFormat = options.format;
    if (!outFormat || outFormat === "auto") {
      outFormat = "webp"; // Default auto format for now
    }
    const cachedFilePath = path.join(CACHE_DIR, `${cacheKey}.${outFormat}`);

    // Try returning cached file
    try {
      const stats = await fs.stat(cachedFilePath);
      const fd = await fs.open(cachedFilePath, "r");
      return {
        stream: fd,
        mime: `image/${outFormat}`,
        size: stats.size,
      };
    } catch {
      // Cache miss, proceed to process
    }

    // Process image
    try {
      let pipeline = sharp(sourcePath);

      // Resize and Fit
      if (options.w || options.h) {
        const resizeOpts: sharp.ResizeOptions = {
          width: options.w,
          height: options.h,
          fit: options.fit,
        };

        // Handle Focal Point if provided (and fit is cover)
        if (options.focal && options.fit === "cover") {
          // const [fxStr, fyStr] = options.focal.split(",");
          // Note: Sharp has basic positional cropping, but true focal point needs math to calculate left/top based on image size.
          // For simplicity, we use sharp's attention or a specific gravity.
          // We will extract metadata to do math if needed, but for now we fallback to 'attention'
          // if we can't implement exact math without fetching metadata.
          
          const metadata = await pipeline.metadata();
          if (metadata.width && metadata.height) {
            // Future math for focal point here. 
            // Currently using 'attention' which is smart crop.
            resizeOpts.position = sharp.strategy.attention;
          }
        }

        pipeline = pipeline.resize(resizeOpts);
      }

      // Format Conversion
      if (outFormat === "webp") {
        pipeline = pipeline.webp({ quality: options.quality });
      } else if (outFormat === "avif") {
        pipeline = pipeline.avif({ quality: options.quality });
      } else if (outFormat === "jpeg") {
        pipeline = pipeline.jpeg({ quality: options.quality });
      } else if (outFormat === "png") {
        pipeline = pipeline.png({ quality: options.quality });
      }

      // Save to cache
      await pipeline.toFile(cachedFilePath);
      
      const stats = await fs.stat(cachedFilePath);
      const fd = await fs.open(cachedFilePath, "r");

      logger.info({ id, cacheKey, outFormat, size: stats.size }, "Processed and cached image");

      return {
        stream: fd,
        mime: `image/${outFormat}`,
        size: stats.size,
      };
    } catch (err) {
      logger.error({ err, id, options }, "Failed to process image");
      throw new Error(`Processing failed: ${(err as Error).message}`);
    }
  }
};
