// src/backend/index.ts
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Import the compareCSVs function from utils.ts
import { compareCSVs } from './compare';

// Setup code for Express, multer, etc.

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../../src/frontend')));
app.use(express.static(path.join(__dirname, '../../src')));

const upload = multer({ dest: 'uploads/' });
// Array to hold data in memory
// Define the type for the data array
interface DataItem {
  files: string[];
  differences: any[]; // Adjust this type based on the actual return type of compareCSVs
}
let data: DataItem[] = [];

// get the front end
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
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
    fs.unlink(filePath, (err) => {
      if (err) throw err;
    });
  });
});
app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
