package com.barberapp.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@Slf4j
public class QrCodeService {

    private static final String BASE_BOOKING_URL = "http://localhost:3000/booking/?slug=";
    private static final String BASE_LOGIN_URL = "http://localhost:3000/dashboard/index.html?slug=";

    public byte[] generateQrCodePng(String text, int width, int height) throws WriterException, IOException {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
        hints.put(EncodeHintType.MARGIN, 1);

        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height, hints);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
        return outputStream.toByteArray();
    }

    public String generateQrCodeBase64Png(String text, int width, int height) throws WriterException, IOException {
        byte[] pngBytes = generateQrCodePng(text, width, height);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngBytes);
    }

    public String generateQrCodeSvg(String text, int width, int height) throws WriterException {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
        hints.put(EncodeHintType.MARGIN, 1);

        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height, hints);

        StringBuilder svg = new StringBuilder();
        svg.append(String.format("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"%d\" height=\"%d\" viewBox=\"0 0 %d %d\">",
                width, height, width, height));
        svg.append("<path fill=\"#FFFFFF\" d=\"M0 0h").append(width).append("v").append(height).append("H0z\"/>");
        svg.append("<path fill=\"#000000\" d=\"");

        int matrixWidth = bitMatrix.getWidth();
        int matrixHeight = bitMatrix.getHeight();
        double cellWidth = (double) width / matrixWidth;
        double cellHeight = (double) height / matrixHeight;

        for (int y = 0; y < matrixHeight; y++) {
            for (int x = 0; x < matrixWidth; x++) {
                if (bitMatrix.get(x, y)) {
                    double left = x * cellWidth;
                    double top = y * cellHeight;
                    svg.append(String.format(java.util.Locale.US, "M%.2f %.2fh%.2fv%.2fH%.2fz ", left, top, cellWidth, cellHeight, left));
                }
            }
        }
        svg.append("\"/></svg>");
        return svg.toString();
    }

    public byte[] generateQrZip(String shopName, String slug, String loginUrl, String bookingUrl) throws IOException, WriterException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            // 1. Login QR PNG
            byte[] loginPng = generateQrCodePng(loginUrl, 300, 300);
            ZipEntry loginPngEntry = new ZipEntry(slug + "-login-qr.png");
            zos.putNextEntry(loginPngEntry);
            zos.write(loginPng);
            zos.closeEntry();

            // 2. Booking QR PNG
            byte[] bookingPng = generateQrCodePng(bookingUrl, 300, 300);
            ZipEntry bookingPngEntry = new ZipEntry(slug + "-booking-qr.png");
            zos.putNextEntry(bookingPngEntry);
            zos.write(bookingPng);
            zos.closeEntry();

            // 3. Login QR SVG
            String loginSvg = generateQrCodeSvg(loginUrl, 300, 300);
            ZipEntry loginSvgEntry = new ZipEntry(slug + "-login-qr.svg");
            zos.putNextEntry(loginSvgEntry);
            zos.write(loginSvg.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 4. Booking QR SVG
            String bookingSvg = generateQrCodeSvg(bookingUrl, 300, 300);
            ZipEntry bookingSvgEntry = new ZipEntry(slug + "-booking-qr.svg");
            zos.putNextEntry(bookingSvgEntry);
            zos.write(bookingSvg.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 5. Links text file
            String linksContent = "=====================================================\n"
                    + "Salon Name: " + shopName + "\n"
                    + "Salon Slug: " + slug + "\n"
                    + "Generated At: " + java.time.LocalDateTime.now() + "\n"
                    + "=====================================================\n\n"
                    + "1. PRIVATE SALON LOGIN & DASHBOARD LINK:\n"
                    + loginUrl + "\n\n"
                    + "2. PUBLIC CUSTOMER BOOKING LINK:\n"
                    + bookingUrl + "\n\n"
                    + "Barber SaaS Platform • Saudi Arabia & GCC\n";
            ZipEntry linksEntry = new ZipEntry(slug + "-links.txt");
            zos.putNextEntry(linksEntry);
            zos.write(linksContent.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return baos.toByteArray();
    }
}
