// src/backend/index.ts
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Import the compareCSVs function from compare.ts
import { compareCSVs, CSVRecord } from './compare';

// Setup code for Express, multer, etc.

const app = express();
const port = process.env.port || 3000

app.use(express.static(path.join(__dirname, '../../src/frontend')));
app.use(express.static(path.join(__dirname, '../../src')));

const upload = multer({ dest: 'uploads/' });
// Array to hold data in memory
// Define the type for the data array
interface DataItem {
  files: string[];
  differences: CSVRecord[];
}
let data: DataItem[] = [];

// get the front end
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
});

// health checks
app.get('/health-check', (req,res) => {
  res.status(200).send('Health check passed')
})

app.get('/bad-health', (req, res) => {
  res.status(500).send('Health check failed');
});

// handle the upload and comparison
app.post('/upload', upload.array('files', 5), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files) {
    return res.status(400).send('No files were uploaded.');
  }

  const file1 = files[0];
  const file2 = files[1];
  const file3 = files[2];
  const file4 = files[3];
  const file5 = files[4];

  const differences = await compareCSVs(
    file1.path,
    file2.path,
    file3.path,
    file4.path,
    file5.path,
  );

  // Store the results in the data array
  data.push({
    files: [
      file1.originalname,
      file2.originalname,
      file3.originalname,
      file4.originalname,
      file5.originalname,
    ],
    differences
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
    fs.unlink(filePath, (err) => {
      if (err) throw err;
    });
  });
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
