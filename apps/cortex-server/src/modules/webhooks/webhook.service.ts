import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { webhooks, webhookDeliveries } from "../../db/schema/index.js";
import type { Webhook, WebhookDelivery } from "../../db/schema/index.js";
import { createHmac, randomBytes } from "node:crypto";
import { getWebhookQueue } from "./webhook.queue.js";

export interface RegisterWebhookInput {
    name: string;
    url: string;
    secret?: string;
    events: string[];
    contentTypes?: string[];
    createdBy?: string;
}

export const webhookService = {
    async register(input: RegisterWebhookInput): Promise<Webhook> {
        try {
            new URL(input.url);
        } catch {
            throw new Error(`Invalid webhook URL: ${input.url}`);
        }

        const secret = input.secret ?? randomBytes(32).toString("hex");

        const [webhook] = await db
            .insert(webhooks)
            .values({
                name: input.name,
                url: input.url,
                secret,
                events: input.events,
                contentTypes: input.contentTypes ?? [],
                createdBy: input.createdBy,
            })
            .returning();

        if (!webhook) throw new Error("Failed to create webhook");
        return webhook;
    },

    async list(filters?: { isActive?: boolean }): Promise<Webhook[]> {
        if (filters?.isActive !== undefined) {
            return db.select().from(webhooks).where(eq(webhooks.isActive, filters.isActive));
        }
        return db.select().from(webhooks);
    },

    async getById(id: string): Promise<Webhook | null> {
        const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
        return webhook ?? null;
    },

    async update(
        id: string,
        patch: Partial<Pick<RegisterWebhookInput, "name" | "url" | "events" | "contentTypes"> & { isActive?: boolean }>,
    ): Promise<Webhook> {
        const [webhook] = await db
            .update(webhooks)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(webhooks.id, id))
            .returning();
        if (!webhook) throw new Error(`Webhook '${id}' not found`);
        return webhook;
    },

    async delete(id: string): Promise<void> {
        const [row] = await db.delete(webhooks).where(eq(webhooks.id, id)).returning({ id: webhooks.id });
        if (!row) throw new Error(`Webhook '${id}' not found`);
    },

    async trigger(event: string, contentType: string, payload: unknown): Promise<void> {
        const candidates = await db.select().from(webhooks).where(eq(webhooks.isActive, true));

        const matching = candidates.filter((wh) => {
            const hasEvent = wh.events.includes(event);
            const hasType = wh.contentTypes.length === 0 || wh.contentTypes.includes(contentType);
            return hasEvent && hasType;
        });

        const queue = getWebhookQueue();
        await Promise.all(
            matching.map((wh) =>
                queue.add("deliver", {
                    webhookId: wh.id,
                    event,
                    contentType,
                    payload,
                    attempt: 1,
                }),
            ),
        );
    },

    async getDeliveries(webhookId: string, opts?: { limit?: number; offset?: number }): Promise<WebhookDelivery[]> {
        return db
            .select()
            .from(webhookDeliveries)
            .where(eq(webhookDeliveries.webhookId, webhookId))
            .limit(opts?.limit ?? 20)
            .offset(opts?.offset ?? 0)
            .orderBy(webhookDeliveries.createdAt);
    },

    async replay(deliveryId: string): Promise<void> {
        const [delivery] = await db
            .select()
            .from(webhookDeliveries)
            .where(eq(webhookDeliveries.id, deliveryId))
            .limit(1);

        if (!delivery) throw new Error(`Delivery '${deliveryId}' not found`);

        const queue = getWebhookQueue();
        await queue.add("deliver", {
            webhookId: delivery.webhookId,
            event: delivery.event,
            contentType: "",
            payload: delivery.payload,
            attempt: delivery.attempt + 1,
        });
    },

    signPayload(secret: string, body: string): string {
        return createHmac("sha256", secret).update(body).digest("hex");
    },
};
