jest.mock('../lib/supabase', () => ({
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: { path: 'notes/123/file.png' }, error: null }),
    })),
  },
}));

const { uploadBufferToStorage } = require('./storage.service');

describe('uploadBufferToStorage', () => {
  it('uploads a note image buffer to Supabase storage and returns the storage path', async () => {
    const result = await uploadBufferToStorage(Buffer.from('image-bytes'), '123', 'photo.png', 'image/png');

    expect(result).toEqual({
      bucket: 'attachments',
      path: 'notes/123/file.png',
    });
  });
});
