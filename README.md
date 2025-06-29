# LLM Remote Executor

A simple yet powerful hybrid API server built with Node.js that allows Large Language Models (LLMs) to securely interact with a file system. The project uses GET requests for simple operations and POST requests for reliably transferring large amounts of data.

## Philosophy

This experimental project is not a replacement for IDE tools but rather an **alternative paradigm** where the AI acts not as an "assistant" but as a central "executor" or "agent", with you as the operator providing access to its tools. This approach grants 100% control, transparency, and the freedom to use any language model. The AI can increasingly be seen as a virtual machine with Docker-like contexts, capable of simulating any environment, even an IDE.

---

## Part 1: Local Setup (Recommended Method)

### Step 1: Prerequisites
1.  Install [Node.js](https://nodejs.org/) (LTS version).
2.  Create a project folder and install dependencies:
    ```bash
    mkdir llm-remote-executor
    cd llm-remote-executor
    npm init -y
    npm install express
    ```

### Step 2: Create Files

Create `server.js` and `config.json` files in the project folder by copying the code from this repository.

**`config.json` (Example):**
```json
{
  "PORT": 3000,
  "SECRET_TOKEN": "your-super-secret-token-here",
  "BASE_DIR": "./local-workspace"
}
```

### Step 3: Run the Server
`node server.js`

---

## Part 2: API Specification and Usage

### 1. Methods and Actions

- **`GET /api`**: For simple operations (`list_dir`, `read_file`, `shell`) and for writing **small files (up to ~2000 characters)**.
- **`POST /api`**: For reliably writing **large files**.

### 2. Practical `curl` Examples

**Listing files (GET):**
```bash
curl "http://localhost:3000/api?token=YOUR_TOKEN&action=list_dir"
```

**Writing a SMALL file (up to ~2000 chars) via GET:**
This method uses `Heredoc` (`<<'EOF'`) and is the most reliable way to pass text with any special characters via GET without terminal errors.
```bash
curl -G "http://localhost:3000/api?token=YOUR_TOKEN&action=write_file&path=small-file.txt" \
  --data-urlencode content@- <<'EOF'
Arbitrary text with any special characters, including ' and " and !, up to ~2000 characters long.
This block will be written to the file as is.
EOF
```

**Writing a LARGE file (over 2000 chars) via POST:**
This is the recommended, most reliable method for writing files, with no size limitations.
```bash
curl -X POST "http://localhost:3000/api" \
-H "Content-Type: application/json" \
-d '{
  "token": "YOUR_TOKEN",
  "action": "write_file",
  "path": "large-file.md",
  "content": "You can insert very large and complex text here...\n...that can span multiple lines.\nThere will be no issues with encoding or length."
}'
```

---

## Part 3: The "User-Mediated `curl` Execution" Workflow

Your interaction with the server follows a strict "Plan-Generate-Await" cycle.

1.  **The user gives you a task.**
2.  **You create a PLAN OF EXECUTION.**
3.  **You generate ONE `curl` command** (using GET or POST depending on data size) for the first step.
4.  **You AWAIT** for the user to execute the command and provide the **ENTIRE terminal output**.
5.  **You analyze the result** and proceed to the next step.