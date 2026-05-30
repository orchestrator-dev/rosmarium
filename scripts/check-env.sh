#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking environment for Rosmarium COS local stack..."

# 1 & 2. Check podman or docker and their versions
HAS_PODMAN=false
HAS_DOCKER=false

if command -v podman &> /dev/null; then
  PODMAN_VERSION=$(podman --version | awk '{print $3}' | cut -d'-' -f1)
  MAJOR_VERSION=$(echo "$PODMAN_VERSION" | cut -d'.' -f1)
  if [ "$MAJOR_VERSION" -ge 4 ]; then
    HAS_PODMAN=true
    echo -e "${GREEN}✓ Podman found (v$PODMAN_VERSION)${NC}"
  else
    echo -e "${YELLOW}! Podman found but version is $PODMAN_VERSION (>= 4.0 recommended)${NC}"
  fi
fi

if ! $HAS_PODMAN && command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
  MAJOR_VERSION=$(echo "$DOCKER_VERSION" | cut -d'.' -f1)
  if [ "$MAJOR_VERSION" -ge 24 ]; then
    HAS_DOCKER=true
    echo -e "${GREEN}✓ Docker found (v$DOCKER_VERSION)${NC}"
  else
    echo -e "${YELLOW}! Docker found but version is $DOCKER_VERSION (>= 24.0 recommended)${NC}"
  fi
fi

if ! $HAS_PODMAN && ! $HAS_DOCKER; then
  echo -e "${RED}✗ Neither Podman (>=4.0) nor Docker (>=24.0) found.${NC}"
  exit 1
fi

RUNTIME=$($HAS_PODMAN && echo "podman" || echo "docker")
echo "Using runtime: $RUNTIME"

# 3. Check compose plugin
HAS_COMPOSE=false
if $HAS_PODMAN && podman compose version &> /dev/null; then
  HAS_COMPOSE=true
  echo -e "${GREEN}✓ podman-compose plugin found${NC}"
elif docker compose version &> /dev/null; then
  HAS_COMPOSE=true
  echo -e "${GREEN}✓ docker compose plugin found${NC}"
fi

if ! $HAS_COMPOSE; then
  echo -e "${RED}✗ Compose plugin not found. Please install podman-compose or docker-compose-plugin.${NC}"
  exit 1
fi

# 4. Check ports
PORTS=(5432 6379 9000 9001)
PORTS_IN_USE=0

for port in "${PORTS[@]}"; do
  if nc -z localhost "$port" 2>/dev/null; then
    echo -e "${RED}✗ Port $port is already in use.${NC}"
    PORTS_IN_USE=$((PORTS_IN_USE + 1))
  else
    echo -e "${GREEN}✓ Port $port is available${NC}"
  fi
done

if [ "$PORTS_IN_USE" -gt 0 ]; then
  echo -e "${RED}✗ One or more required ports are already bound. Please free them before starting the stack.${NC}"
  exit 1
fi

# 5. Success
echo -e "\n${GREEN}Ready to run pnpm infra:up${NC}"
exit 0
