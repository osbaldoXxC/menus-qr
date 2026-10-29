const multer = require('multer');
const { S3 } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('../config/s3');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Usar memoria para procesar la imagen antes de subirla
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite inicial de subida 5MB
  }
});

const esImagenValida = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  
  // Convertir los primeros bytes a hex para comparar firmas conocidas (Magic Bytes)
  const hex = buffer.toString('hex', 0, 12).toUpperCase();
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504E470D0A1A0A')) return true;
  // JPEG / JPG: FF D8 FF
  if (hex.startsWith('FFD8FF')) return true;
  // WEBP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (hex.startsWith('52494646') && hex.substring(16, 24) === '57454250') return true;
  // GIF: GIF8 (47 49 46 38)
  if (hex.startsWith('47494638')) return true;
  
  return false;
};

// Middleware para procesar y optimizar la imagen
const optimizeImage = async (req, res, next) => {
  if (!req.file) return next();

  // Validar magic bytes (Firma de archivo real) para mitigar subida de ejecutables / shells
  if (!esImagenValida(req.file.buffer)) {
    return res.status(400).json({ mensaje: 'El archivo subido no es una imagen válida (magic bytes no coinciden)' });
  }

  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `${uniqueSuffix}.webp`;
    const s3Key = `dishes/${fileName}`;

    // 1. Procesar con SHARP: Convertir a WebP y comprimir
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60, effort: 6 })
      .toBuffer();

    // 2. Intentar subir a S3 si S3_BUCKET_NAME está configurado y no es 'dummy'
    if (process.env.S3_BUCKET_NAME && process.env.S3_BUCKET_NAME !== 'dummy') {
      try {
        const s3Params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: optimizedBuffer,
          ContentType: 'image/webp'
        };

        // Solo se agrega ACL si se define explícitamente en el entorno S3_USE_ACL=true,
        // ya que los buckets de AWS S3 nuevos vienen con ACLs deshabilitadas por defecto (Bucket Owner Enforced).
        if (process.env.S3_USE_ACL === 'true') {
          s3Params.ACL = 'public-read';
        }

        const parallelUploadS3 = new Upload({
          client: s3Client,
          params: s3Params,
        });
        const result = await parallelUploadS3.done();
        req.file.location = result.Location || `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
        req.file.key = s3Key;
        req.file.isLocal = false;
        return next();
      } catch (s3Error) {
        console.error('Error al subir a AWS S3 (revisa ACL/permisos de bucket o credentials):', s3Error);
        // Continuar al almacenamiento local si falla S3
      }
    }

    // Fallback: Almacenamiento local en uploads/dishes si S3 no está configurado o falló
    const uploadDir = path.join(__dirname, '../../uploads/dishes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(localFilePath, optimizedBuffer);

    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    req.file.location = `${backendUrl}/uploads/dishes/${fileName}`;
    req.file.key = s3Key;
    req.file.isLocal = true;

    next();
  } catch (error) {
    console.error('Error optimizando imagen:', error);
    res.status(500).json({ mensaje: 'Error al procesar la imagen' });
  }
};

module.exports = { upload, optimizeImage };
