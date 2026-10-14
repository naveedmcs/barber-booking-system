package com.barberapp.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevController {

    private final AuthController authController;

    @GetMapping("/reset-links")
    public ResponseEntity<?> getResetLinks() {
        return authController.getDevResetLinks();
    }
}
