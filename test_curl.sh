#!/bin/bash
COOKIE=$(curl -s -c cookie.txt -d '{"email":"admin@rosmarium.local","password":"rosmarium_dev_password"}' -H "Content-Type: application/json" -X POST http://localhost:3000/api/auth/login)
echo "Login response: $COOKIE"

API_KEY_RES=$(curl -s -b cookie.txt -d '{"name":"Test API Key","scopes":["*"]}' -H "Content-Type: application/json" -X POST http://localhost:3000/api/auth/api-keys)
echo "API Key response: $API_KEY_RES"
API_KEY=$(echo $API_KEY_RES | grep -o '"rawKey":"[^"]*' | cut -d'"' -f4)
echo "API Key: $API_KEY"

JOB_RES=$(curl -s -b cookie.txt -H "X-Api-Key: $API_KEY" -d '{"name":"DB Ingest Test","source":{"type":"database","provider":"postgres","connectionString":"postgres://postgres:rosmarium@localhost:5432/rosmarium","queryOrCollection":"SELECT id, name FROM content_types"},"targetType":"article","importAs":"draft","maxDepth":1,"respectRobotsTxt":true,"maxPages":10,"classificationModel":"llama3.1:8b"}' -H "Content-Type: application/json" -X POST http://localhost:3000/api/ingestor/jobs)
echo "Job response: $JOB_RES"
