const crypto = require('crypto');
const supabase = require('../lib/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

function buildPath(noteId, filename) {
  const safeName = (filename || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `notes/${noteId}/${crypto.randomUUID()}-${safeName}`;
}

function getExtensionFromMime(mimetype) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/csv': 'csv',
  };

  return map[mimetype] || 'bin';
}

async function upload(file, noteId) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  return uploadBufferToStorage(file.buffer, noteId, file.originalname, file.mimetype);
}

async function uploadBufferToStorage(buffer, noteId, filename, mimetype) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  const safeName = (filename || `file.${getExtensionFromMime(mimetype)}`).replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = buildPath(noteId, safeName);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimetype,
      upsert: false
    });

  if (error) {
    throw error;
  }

  return {
    bucket: BUCKET,
    path: data.path,
  };
}

async function download(bucket, path) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

async function deleteFile(bucket, path) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

async function createSignedUrl(bucket, path, expiresInSeconds = 60) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

module.exports = {
  upload,
  uploadBufferToStorage,
  download,
  deleteFile,
  createSignedUrl,
  BUCKET,
};
