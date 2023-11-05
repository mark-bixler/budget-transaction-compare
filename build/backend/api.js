"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/backend/index.ts
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Import the compareCSVs function from utils.ts
const compare_1 = require("./compare");
// Setup code for Express, multer, etc.
const app = (0, express_1.default)();
const port = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, '../../src/frontend')));
app.use(express_1.default.static(path_1.default.join(__dirname, '../../src')));
const upload = (0, multer_1.default)({ dest: 'uploads/' });
let data = [];
// get the front end
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../src/frontend/index.html'));
});
// health checks
app.get('/health-check', (req, res) => {
    res.status(200).send('Health check passed');
});
app.get('/bad-health', (req, res) => {
    res.status(500).send('Health check failed');
});
// handle the upload and comparison
app.post('/upload', upload.array('files', 5), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const files = req.files;
    if (!files) {
        return res.status(400).send('No files were uploaded.');
    }
    const file1 = files[0];
    const file2 = files[1];
    const file3 = files[2];
    const file4 = files[3];
    const file5 = files[4];
    const differences = yield (0, compare_1.compareCSVs)(file1.path, file2.path, file3.path, file4.path, file5.path);
    // Store the results in the data array
    data.push({
        files: [
            file1.originalname,
            file2.originalname,
            file3.originalname,
            file4.originalname,
            file5.originalname,
        ],
        differences,
    });
    res.json(differences);
    // Delete the files after sending the response
    const filePaths = [
        file1.path,
        file2.path,
        file3.path,
        file4.path,
        file5.path,
    ];
    // Loop through the file paths and delete the files
    filePaths.forEach((filePath) => {
        fs_1.default.unlink(filePath, (err) => {
            if (err)
                throw err;
        });
    });
}));
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
