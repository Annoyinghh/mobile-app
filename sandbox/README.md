# NetOps Repair Sandbox Deployment Guide

This directory houses the containerized sandbox environment for the Network Operations & Repair project. It spins up the PC Agent (Node.js backend server) and the Mobile Client (Nginx-hosted HTML/CSS/JS frontend simulator) in isolated environments.

## System Architecture

The sandbox launches two services:
1. **`pc-agent` (Port 3001)**: Run inside an Alpine container with standard networking diagnostic tools (`iputils`, `bind-tools`, `procps`). Runs a WebSocket server providing live telemetry, network testing, and repair execution.
2. **`mobile-client` (Port 3080)**: Run inside an Nginx container serving a web page simulator designed like a smartphone app dashboard. It connects to the agent and interacts with it.

---

## Getting Started

### 1. Build and Start the Containers

From the project root (`D:\薛梓炫知识库\netops-repair-wiki`), run:
```bash
docker compose -f sandbox/docker-compose.yml up --build -d
```

Verify that the containers are running:
```bash
docker compose -f sandbox/docker-compose.yml ps
```

### 2. Access the Simulator

1. Open your browser and navigate to `http://localhost:3080`.
2. You will see a beautiful smartphone interface.
3. Locate the **Agent Connection** card at the top. The prefilled WebSocket address `ws://localhost:3001` connects directly to the containerized PC Agent.
4. Click **Connect**.
5. Once connected, you will see live CPU/Memory telemetry updating every 3 seconds, system info matching the Linux Docker container, and an active process list.

### 3. Run Diagnostics and Repairs

- **Test Network**: Click the button to request the Agent to ping `8.8.8.8`, resolve `google.com`, check localhost ports, and report latency.
- **One-Click Repair**: Select an action (e.g., *Flush DNS Cache* or *Clean Temporary Files*) and click *Execute Auto-Repair*. The log console will stream step-by-step progress events dispatched by the Agent.

---

## Running Locally (Outside Docker)

If you prefer to run or debug the PC Agent locally on your host Windows machine:

1. Install dependencies for the agent:
   ```bash
   cd src/pc-agent
   npm install
   ```
2. Start the Agent:
   ```bash
   npm start
   ```
3. Open `src/mobile-client/index.html` directly in your browser.
4. Connect to `ws://localhost:3001` and verify live Windows diagnostics!

---

## Stopping the Sandbox

To shut down and remove the sandbox containers:
```bash
docker compose -f sandbox/docker-compose.yml down
```
