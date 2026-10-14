package com.barberapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class MediaStorageService {

    public static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    public static final long MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB for avatars

    private static final List<String> ALLOWED_MIME_TYPES = Arrays.asList(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
    );

    @Value("${media.upload-dir:uploads}")
    private String baseUploadDir;

    /**
     * Validates and stores a salon gallery image (max 5MB).
     */
    public String storeSalonGalleryImage(Long salonId, MultipartFile file) throws IOException {
        validateImageFile(file);
        String subFolder = "salons/" + salonId + "/gallery";
        return storeFileOnDisk(subFolder, file);
    }

    /**
     * Validates and stores a salon branding image (logo or cover banner, max 5MB).
     */
    public String storeSalonBrandingImage(Long salonId, String category, MultipartFile file) throws IOException {
        validateImageFile(file);
        String subFolder = "salons/" + salonId + "/" + (category != null ? category : "branding");
        return storeFileOnDisk(subFolder, file);
    }

    /**
     * Validates and stores a staff member avatar image (max 2MB).
     */
    public String storeStaffAvatar(Long salonId, Long barberId, MultipartFile file) throws IOException {
        validateAvatarFile(file);
        String subFolder = "salons/" + salonId + "/avatars";
        return storeFileOnDisk(subFolder, file);
    }

    public String storeStaffAvatar(Long salonId, MultipartFile file) throws IOException {
        return storeStaffAvatar(salonId, null, file);
    }

    /**
     * Avatar-specific validation enforcing <= 2MB limit.
     */
    public void validateAvatarFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty.");
        }
        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new IllegalArgumentException("Avatar image size exceeds 2MB limit. Uploaded size: " + (file.getSize() / 1024 / 1024) + "MB.");
        }
        validateImageContent(file);
    }

    /**
     * Core validation for file size (5MB), MIME type, and magic bytes.
     */
    public void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 5MB limit. Uploaded size: " + (file.getSize() / 1024 / 1024) + "MB.");
        }
        validateImageContent(file);
    }

    private void validateImageContent(MultipartFile file) {

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Invalid file type '" + contentType + "'. Only JPEG, PNG, and WebP are permitted.");
        }

        // Verify magic bytes
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[12];
            int read = is.read(header);
            if (read < 4 || !matchesImageSignature(header)) {
                throw new IllegalArgumentException("File content does not match a valid image signature.");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read file stream for validation: " + e.getMessage());
        }
    }

    private boolean matchesImageSignature(byte[] header) {
        // JPEG: FF D8 FF
        if ((header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF) {
            return true;
        }
        // PNG: 89 50 4E 47
        if ((header[0] & 0xFF) == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47) {
            return true;
        }
        // WebP: RIFF .... WEBP
        if (header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F' &&
            header.length >= 12 && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') {
            return true;
        }
        return false;
    }

    private String storeFileOnDisk(String subFolder, MultipartFile file) throws IOException {
        Path targetDir = Paths.get(baseUploadDir, subFolder).toAbsolutePath().normalize();
        if (!Files.exists(targetDir)) {
            Files.createDirectories(targetDir);
        }

        String extension = getFileExtension(file.getOriginalFilename(), file.getContentType());
        String uniqueFileName = UUID.randomUUID().toString() + extension;
        Path targetFilePath = targetDir.resolve(uniqueFileName);

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetFilePath, StandardCopyOption.REPLACE_EXISTING);
        }

        log.info("Saved media asset to disk: {}", targetFilePath);
        return "/uploads/" + subFolder + "/" + uniqueFileName;
    }

    private String getFileExtension(String originalFilename, String contentType) {
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            if (Arrays.asList(".jpg", ".jpeg", ".png", ".webp").contains(ext)) {
                return ext;
            }
        }
        if (contentType != null) {
            if (contentType.equalsIgnoreCase("image/png")) return ".png";
            if (contentType.equalsIgnoreCase("image/webp")) return ".webp";
        }
        return ".jpg";
    }

    /**
     * Delete file from local disk if it belongs to uploads.
     */
    public boolean deleteFile(String fileUrl) {
        if (fileUrl == null || !fileUrl.startsWith("/uploads/")) {
            return false;
        }
        try {
            String relativePath = fileUrl.substring("/uploads/".length());
            Path targetFile = Paths.get(baseUploadDir, relativePath).toAbsolutePath().normalize();
            return Files.deleteIfExists(targetFile);
        } catch (Exception e) {
            log.warn("Could not delete file {}: {}", fileUrl, e.getMessage());
            return false;
        }
    }
}
