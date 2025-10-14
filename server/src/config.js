import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
  clientOrigin: process.env.CLIENT_ORIGIN || '*'
};

