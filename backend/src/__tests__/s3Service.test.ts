process.env.S3_BUCKET_NAME = 'class-reunion-photos';

// Mock AWS SDK BEFORE importing s3Service
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => params),
  GetObjectCommand: jest.fn().mockImplementation((params) => params),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => params)
}));

// Mock the s3-request-presigner BEFORE importing s3Service
const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

// Mock the database BEFORE importing s3Service
const mockQuery = jest.fn();
jest.mock('../db', () => ({
  query: mockQuery
}));

import {
  generatePresignedUrl,
  uploadFileToS3,
  deleteUserPhotosFromS3,
  updatePhotoUrlInDatabase
} from '../s3Service';

describe('S3 Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generatePresignedUrl', () => {
    it('should generate a presigned URL for file upload', async () => {
      const mockUrl = 'https://example.com/presigned-url-with-token';
      mockGetSignedUrl.mockResolvedValueOnce(mockUrl);

      const result = await generatePresignedUrl(1, 'profile.jpg');

      expect(result).toBe(mockUrl);
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should use correct key format', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://example.com/url');

      await generatePresignedUrl(42, 'photo.png');

      const callArgs = mockGetSignedUrl.mock.calls[mockGetSignedUrl.mock.calls.length - 1];
      const command = callArgs[1];
      expect(command.Key).toBe('photos/42/photo.png');
    });

    it('should set correct bucket name', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://example.com/url');

      await generatePresignedUrl(1, 'image.jpg');

      const callArgs = mockGetSignedUrl.mock.calls[mockGetSignedUrl.mock.calls.length - 1];
      const command = callArgs[1];
      expect(command.Bucket).toBe('class-reunion-photos');
    });

    it('should set expiration time', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://example.com/url');

      await generatePresignedUrl(1, 'photo.jpg');

      const callArgs = mockGetSignedUrl.mock.calls[mockGetSignedUrl.mock.calls.length - 1];
      const options = callArgs[2];
      expect(options.expiresIn).toBe(3600);
    });

    it('should throw error when presigned URL generation fails', async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error('S3 service error'));

      await expect(generatePresignedUrl(1, 'photo.jpg')).rejects.toThrow('Failed to generate presigned URL');
    });
  });

  describe('uploadFileToS3', () => {
    it('should upload file to S3 and return public URL', async () => {
      mockSend.mockResolvedValueOnce({});

      const fileBuffer = Buffer.from('fake image data');
      const result = await uploadFileToS3(1, 'photo.jpg', fileBuffer);

      expect(result).toContain('class-reunion-photos/photos/1/photo.jpg');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should use correct S3 key format', async () => {
      mockSend.mockResolvedValueOnce({});

      const fileBuffer = Buffer.from('test data');
      await uploadFileToS3(42, 'image.png', fileBuffer);

      const callArgs = mockSend.mock.calls[0];
      const command = callArgs[0];
      expect(command.Key).toBe('photos/42/image.png');
    });

    it('should upload file body to S3', async () => {
      mockSend.mockResolvedValueOnce({});

      const fileBuffer = Buffer.from('file contents');
      await uploadFileToS3(1, 'photo.jpg', fileBuffer);

      const callArgs = mockSend.mock.calls[0];
      const command = callArgs[0];
      expect(command.Body).toBe(fileBuffer);
    });

    it('should set correct bucket name', async () => {
      mockSend.mockResolvedValueOnce({});

      await uploadFileToS3(1, 'photo.jpg', Buffer.from('data'));

      const callArgs = mockSend.mock.calls[0];
      const command = callArgs[0];
      expect(command.Bucket).toBe('class-reunion-photos');
    });

    it('should throw error when S3 upload fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadFileToS3(1, 'photo.jpg', Buffer.from('data'))).rejects.toThrow('Failed to upload file to S3');
    });
  });

  describe('deleteUserPhotosFromS3', () => {
    it('should delete all user photos from S3', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          then_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/then.jpg',
          now_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/now.jpg'
        }]
      });
      mockSend.mockResolvedValue({});

      await deleteUserPhotosFromS3(1);

      // Should call send twice (once for each photo)
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should query database for user profile', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          then_photo_url: null,
          now_photo_url: null
        }]
      });

      await deleteUserPhotosFromS3(5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT then_photo_url, now_photo_url FROM profiles'),
        [5]
      );
    });

    it('should handle missing profile gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(deleteUserPhotosFromS3(999)).resolves.not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should only delete non-null photo URLs', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          then_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/then.jpg',
          now_photo_url: null
        }]
      });
      mockSend.mockResolvedValue({});

      await deleteUserPhotosFromS3(1);

      // Should only call send once (for then_photo_url)
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should extract correct S3 key from URL', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          then_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/myfile.jpg',
          now_photo_url: null
        }]
      });
      mockSend.mockResolvedValue({});

      await deleteUserPhotosFromS3(1);

      const callArgs = mockSend.mock.calls[0];
      const command = callArgs[0];
      expect(command.Key).toBe('photos/1/myfile.jpg');
    });

    it('should continue deleting even if one delete fails', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          then_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/then.jpg',
          now_photo_url: 'http://localhost:4566/class-reunion-photos/photos/1/now.jpg'
        }]
      });
      mockSend
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce({});

      await expect(deleteUserPhotosFromS3(1)).resolves.not.toThrow();
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should not throw error if database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(deleteUserPhotosFromS3(1)).resolves.not.toThrow();
    });
  });

  describe('updatePhotoUrlInDatabase', () => {
    it('should update then photo URL in database', async () => {
      mockQuery.mockResolvedValueOnce({});

      await updatePhotoUrlInDatabase(1, 'https://example.com/then.jpg', 'then');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('then_photo_url'),
        expect.arrayContaining(['https://example.com/then.jpg', 1])
      );
    });

    it('should update now photo URL in database', async () => {
      mockQuery.mockResolvedValueOnce({});

      await updatePhotoUrlInDatabase(1, 'https://example.com/now.jpg', 'now');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('now_photo_url'),
        expect.arrayContaining(['https://example.com/now.jpg', 1])
      );
    });

    it('should throw error when database update fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        updatePhotoUrlInDatabase(1, 'https://example.com/photo.jpg', 'then')
      ).rejects.toThrow('Failed to update database record');
    });

    it('should use correct user ID', async () => {
      mockQuery.mockResolvedValueOnce({});

      await updatePhotoUrlInDatabase(42, 'https://example.com/photo.jpg', 'then');

      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs[1][1]).toBe(42);
    });

    it('should use correct photo URL', async () => {
      mockQuery.mockResolvedValueOnce({});

      const photoUrl = 'https://s3.example.com/photos/abc123.jpg';
      await updatePhotoUrlInDatabase(1, photoUrl, 'then');

      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs[1][0]).toBe(photoUrl);
    });
  });
});
