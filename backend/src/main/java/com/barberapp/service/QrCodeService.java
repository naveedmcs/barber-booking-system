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
import java.util.EnumMap;
import java.util.Map;

@Service
@Slf4j
public class QrCodeService {

    private static final String BASE_BOOKING_URL = "https://book.barberapp.sa/";

    public byte[] generateQrCodePng(String slug, int width, int height) throws WriterException, IOException {
        String url = BASE_BOOKING_URL + slug;
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
        hints.put(EncodeHintType.MARGIN, 1);

        BitMatrix bitMatrix = qrCodeWriter.encode(url, BarcodeFormat.QR_CODE, width, height, hints);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
        return outputStream.toByteArray();
    }

    public String generateQrCodeSvg(String slug, int width, int height) throws WriterException {
        String url = BASE_BOOKING_URL + slug;
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
        hints.put(EncodeHintType.MARGIN, 1);

        BitMatrix bitMatrix = qrCodeWriter.encode(url, BarcodeFormat.QR_CODE, width, height, hints);

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
                    svg.append(String.format("M%.2f %.2fh%.2fv%.2fH%.2fz ", left, top, cellWidth, cellHeight, left));
                }
            }
        }
        svg.append("\"/></svg>");
        return svg.toString();
    }
}
