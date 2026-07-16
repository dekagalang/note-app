const crypto = require('crypto');
const supabase = require('../lib/supabase');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

function buildPath(noteId, filename) {
  const safeName = (filename || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `notes/${noteId}/${crypto.randomUUID()}-${safeName}`;
}

async function upload(file, noteId) {
  if (!supabase) {
    throw new Error('Supabase storage is not configured.');
  }

  const path = buildPath(noteId, file.originalname);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
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
  download,
  deleteFile,
  createSignedUrl,
  BUCKET,
};
