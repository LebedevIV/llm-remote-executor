const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

let config;
try {
    const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configFile);
} catch (err) {
    console.error("FATAL ERROR: Could not read or parse config.json.", err);
    process.exit(1);
}

const app = express();
const PORT = config.PORT || 3000;
const SECRET_TOKEN = config.SECRET_TOKEN;
const BASE_DIR = path.resolve(__dirname, config.BASE_DIR);

if (!SECRET_TOKEN || !BASE_DIR) {
    console.error("FATAL ERROR: SECRET_TOKEN and BASE_DIR must be set in config.json.");
    process.exit(1);
}

if (!fs.existsSync(BASE_DIR)){
    fs.mkdirSync(BASE_DIR, { recursive: true });
    console.log(`Base directory created at: ${BASE_DIR}`);
}

const resolvePath = (userPath) => {
    // Express УЖЕ декодирует userPath из req.query.path
    if (typeof userPath !== 'string') {
        return BASE_DIR;
    }
    const normalizedPath = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const finalPath = path.join(BASE_DIR, normalizedPath);
    if (!finalPath.startsWith(BASE_DIR)) {
        throw new Error('Access denied: Path is outside the allowed workspace.');
    }
    return finalPath;
};

app.get('/api', async (req, res) => {
    // Express УЖЕ декодирует все значения в req.query
    const { token, action, path: userPath, content, command } = req.query;

    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!action) {
        return res.status(400).json({ error: 'Action required' });
    }

    try {
        switch (action) {
            case 'write_file': {
                const safePath = resolvePath(userPath);
                // Просто используем `content`, т.к. Express его уже раскодировал
                const fileContent = content || '';
                await fsp.mkdir(path.dirname(safePath), { recursive: true });
                await fsp.writeFile(safePath, fileContent, 'utf8');
                return res.status(200).json({ success: true, message: `File written to ${userPath}` });
            }
            case 'read_file': {
                const safePath = resolvePath(userPath);
                const fileContent = await fsp.readFile(safePath, 'utf8');
                return res.type('text/plain').send(fileContent);
            }
            case 'list_dir': {
                const safePath = resolvePath(userPath);
                const files = await fsp.readdir(safePath);
                return res.status(200).json({ success: true, files });
            }
            case 'shell': {
                // Просто используем `command`, т.к. Express его уже раскодировал
                const shellCommand = command || '';
                exec(shellCommand, { cwd: BASE_DIR }, (error, stdout, stderr) => {
                    res.status(200).json({ stdout, stderr, error: error ? error.message : null });
                });
                break;
            }
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`LLM Remote Executor (Local Mode) is running.`);
    console.log(`Listening on: http://localhost:${PORT}`);
    console.log(`Serving files in: ${BASE_DIR}`);
});