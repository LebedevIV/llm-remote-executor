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

// Middleware для POST-запросов
// Увеличиваем лимит, чтобы поддерживать большие файлы
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));


const resolvePath = (userPath) => {
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

// Общая функция обработки запросов
const handleRequest = async (params, res) => {
    const { token, action, path: userPath, content, command } = params;

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
                const fileContent = content || '';
                
                // Отладочная информация в консоли сервера
                console.log(`Action: write_file, Path: ${userPath}, Content Length: ${fileContent.length}`);
                
                await fsp.mkdir(path.dirname(safePath), { recursive: true });
                await fsp.writeFile(safePath, fileContent, 'utf8');
                return res.status(200).json({ 
                    success: true, 
                    message: `File written to ${userPath}`,
                    contentLength: fileContent.length 
                });
            }
            case 'read_file': {
                const safePath = resolvePath(userPath);
                const fileContent = await fsp.readFile(safePath, 'utf8');
                // Для GET-запроса возвращаем как text/plain, для POST (если понадобится) - в JSON
                if (res.req.method === 'GET') {
                    return res.type('text/plain').send(fileContent);
                }
                return res.status(200).json({ success: true, content: fileContent });
            }
            case 'list_dir': {
                const safePath = resolvePath(userPath);
                const files = await fsp.readdir(safePath);
                return res.status(200).json({ success: true, files });
            }
            case 'shell': {
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
        console.error(err); // Выводим ошибку в консоль сервера для диагностики
        return res.status(500).json({ error: err.message });
    }
};

// Обработчик для GET-запросов (для простых операций)
app.get('/api', async (req, res) => {
    await handleRequest(req.query, res);
});

// Обработчик для POST-запросов (для сложных операций, например, записи файлов)
app.post('/api', async (req, res) => {
    // Определяем, откуда брать параметры, в зависимости от Content-Type
    let params;
    if (req.is('application/json')) {
        params = req.body;
    } else if (req.is('text/plain')) {
        // Если кто-то отправит контент как чистый текст, а параметры в URL
        params = { ...req.query, content: req.body };
    } else {
        // Для стандартных форм
        params = { ...req.query, ...req.body };
    }
    
    await handleRequest(params, res);
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`LLM Remote Executor (Enhanced Hybrid Mode) is running.`);
    console.log(`Listening on: http://localhost:${PORT}`);
    console.log(`Serving files in: ${BASE_DIR}`);
    console.log(`Supports GET for simple actions and POST for file writing.`);
});