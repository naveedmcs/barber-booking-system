package com.barberapp.controller;

import com.barberapp.entity.*;
import com.barberapp.entity.enums.BookingStatus;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.*;
import com.barberapp.service.SlotLockService;
import com.barberapp.service.SalonAnalyticsService;
import com.barberapp.service.MediaStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import com.barberapp.dto.RevenueAnalyticsDTO;
import org.springframework.mock.web.MockMultipartFile;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class SalonPortalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private ShopRepository shopRepository;

    @MockBean
    private BarberRepository barberRepository;

    @MockBean
    private BookingRepository bookingRepository;

    @MockBean
    private ServiceItemRepository serviceItemRepository;

    @MockBean
    private CustomerRepository customerRepository;

    @MockBean
    private WorkingHoursRepository workingHoursRepository;

    @MockBean
    private SlotLockService slotLockService;

    @MockBean
    private SalonAnalyticsService salonAnalyticsService;

    @MockBean
    private MediaStorageService mediaStorageService;

    @MockBean
    private SalonImageRepository salonImageRepository;

    @MockBean
    private com.barberapp.service.AuditLogService auditLogService;

    private User ownerUser;
    private User staffUser;
    private Shop shop;
    private Barber barberAhmed;
    private Barber barberSami;
    private ServiceItem serviceHaircut;
    private Customer customerAli;
    private Booking sampleBooking;

    @BeforeEach
    void setUp() {
        when(slotLockService.acquireSlotHold(anyLong(), any())).thenReturn(true);

        ownerUser = User.builder()
                .id(100L)
                .email("owner@test.sa")
                .fullName("Test Owner")
                .role(UserRole.SALON_OWNER)
                .salonId(200L)
                .active(true)
                .build();

        staffUser = User.builder()
                .id(101L)
                .email("staff@test.sa")
                .fullName("Ahmed Staff")
                .role(UserRole.SALON_STAFF)
                .salonId(200L)
                .active(true)
                .build();

        shop = Shop.builder()
                .id(200L)
                .name("Elite Salon")
                .slug("elite-salon")
                .city("Riyadh")
                .district("Olaya")
                .build();

        barberAhmed = Barber.builder()
                .id(300L)
                .shop(shop)
                .user(staffUser)
                .name("Ahmed Staff")
                .build();

        barberSami = Barber.builder()
                .id(301L)
                .shop(shop)
                .name("Sami Barber")
                .build();

        serviceHaircut = ServiceItem.builder()
                .id(400L)
                .shop(shop)
                .name("Haircut & Beard")
                .durationMinutes(30)
                .price(new BigDecimal("50.00"))
                .build();

        customerAli = Customer.builder()
                .id(500L)
                .fullName("Ali Test")
                .phone("0512345678")
                .email("0512345678@walkin.guest")
                .build();

        sampleBooking = Booking.builder()
                .id(600L)
                .shop(shop)
                .barber(barberAhmed)
                .service(serviceHaircut)
                .customer(customerAli)
                .slotStart(LocalDateTime.now().plusHours(2))
                .slotEnd(LocalDateTime.now().plusHours(2).plusMinutes(30))
                .status(BookingStatus.CONFIRMED)
                .build();
    }

    @Test
    void testGetPortalContext_Owner_Success() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));

        mockMvc.perform(get("/api/portal/context")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salonId").value(200))
                .andExpect(jsonPath("$.salonName").value("Elite Salon"))
                .andExpect(jsonPath("$.owner").value(true))
                .andExpect(jsonPath("$.staff").value(false))
                .andExpect(jsonPath("$.accessibleModules[0]").value("bookings"));
    }

    @Test
    void testGetPortalContext_Staff_Success() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findByUserId(101L)).thenReturn(Optional.of(barberAhmed));

        mockMvc.perform(get("/api/portal/context")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.salonId").value(200))
                .andExpect(jsonPath("$.owner").value(false))
                .andExpect(jsonPath("$.staff").value(true))
                .andExpect(jsonPath("$.user.staffId").value(300))
                .andExpect(jsonPath("$.accessibleModules[0]").value("schedule"));
    }

    @Test
    void testGetPortalStaff_StaffForbidden() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));

        mockMvc.perform(get("/api/portal/staff")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Access Denied"));
    }

    @Test
    void testGetPortalBookings_StaffScopeRestriction() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));
        when(barberRepository.findByUserId(101L)).thenReturn(Optional.of(barberAhmed));

        mockMvc.perform(get("/api/portal/bookings")
                        .param("userId", "101")
                        .param("barberId", "999")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Staff Scope Restriction"));
    }

    @Test
    void testToggleStaffShift_Success() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));

        mockMvc.perform(patch("/api/portal/shift")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"OFFLINE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shiftStatus").value("OFFLINE"));
    }

    @Test
    void testCreateWalkInBooking_ConflictThrows409() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(serviceItemRepository.findById(400L)).thenReturn(Optional.of(serviceHaircut));

        // Simulate conflict
        when(bookingRepository.findConflictingBookings(eq(200L), eq(300L), any(), any(), any(), isNull()))
                .thenReturn(List.of(sampleBooking));

        mockMvc.perform(post("/api/portal/bookings/walk-in")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"serviceId\": 400, \"customerName\": \"Walk In Test\", \"customerPhone\": \"0599999999\", \"slotStart\": \"2026-10-15T10:00:00\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Slot Conflict"));
    }

    @Test
    void testCreateWalkInBooking_Success() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(serviceItemRepository.findById(400L)).thenReturn(Optional.of(serviceHaircut));
        when(customerRepository.findByPhone("0599999999")).thenReturn(Optional.of(customerAli));

        // No conflict
        when(bookingRepository.findConflictingBookings(eq(200L), eq(300L), any(), any(), any(), isNull()))
                .thenReturn(List.of());
        when(bookingRepository.save(any(Booking.class))).thenReturn(sampleBooking);

        mockMvc.perform(post("/api/portal/bookings/walk-in")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"serviceId\": 400, \"customerName\": \"Ali Test\", \"customerPhone\": \"0599999999\", \"slotStart\": \"2026-10-15T10:00:00\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(600));
    }

    @Test
    void testBlockSlot_StaffForbidden() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));

        mockMvc.perform(post("/api/portal/bookings/block")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"slotStart\": \"2026-10-15T12:00:00\", \"slotEnd\": \"2026-10-15T13:00:00\", \"reason\": \"Break\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Access Denied"));
    }

    @Test
    void testUpdateBookingStatus_StaffArrivedSuccess() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));
        when(barberRepository.findByUserId(101L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findById(600L)).thenReturn(Optional.of(sampleBooking));
        when(bookingRepository.save(any(Booking.class))).thenReturn(sampleBooking);

        mockMvc.perform(patch("/api/portal/bookings/600/status")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"ARRIVED\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void testUpdateBookingStatus_StaffCannotCancelThrowsForbidden() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));
        when(barberRepository.findByUserId(101L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findById(600L)).thenReturn(Optional.of(sampleBooking));

        mockMvc.perform(patch("/api/portal/bookings/600/status")
                        .param("userId", "101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"CANCELLED\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Forbidden"));
    }

    @Test
    void testReassignBooking_OwnerSuccess() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findById(301L)).thenReturn(Optional.of(barberSami));
        when(bookingRepository.findById(600L)).thenReturn(Optional.of(sampleBooking));
        when(bookingRepository.findConflictingBookings(eq(200L), eq(301L), any(), any(), any(), eq(600L)))
                .thenReturn(List.of());
        when(bookingRepository.save(any(Booking.class))).thenReturn(sampleBooking);

        mockMvc.perform(patch("/api/portal/bookings/600/reassign")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newBarberId\": 301}"))
                .andExpect(status().isOk());
    }

    @Test
    void testAddStaffMember_Success() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(userRepository.findByEmail("newbarber@goldenscissors.sa")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(555L);
            return u;
        });
        when(barberRepository.save(any(Barber.class))).thenAnswer(i -> {
            Barber b = i.getArgument(0);
            b.setId(777L);
            return b;
        });

        mockMvc.perform(post("/api/portal/staff")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Kareem Stylist\", \"specialty\": \"Fade Specialist\", \"phone\": \"0507778899\", \"email\": \"newbarber@goldenscissors.sa\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Kareem Stylist"))
                .andExpect(jsonPath("$.specialty").value("Fade Specialist"))
                .andExpect(jsonPath("$.isActive").value(true));
    }

    @Test
    void testStaffSchedule_GetAndUpdate() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(300L)).thenReturn(List.of(
                WorkingHours.builder()
                        .barber(barberAhmed)
                        .dayOfWeek(1)
                        .startTime(java.time.LocalTime.of(9, 0))
                        .endTime(java.time.LocalTime.of(18, 0))
                        .isOff(false)
                        .breakStart(java.time.LocalTime.of(13, 0))
                        .breakEnd(java.time.LocalTime.of(14, 0))
                        .build()
        ));

        mockMvc.perform(get("/api/portal/staff/300/schedule")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.barberId").value(300))
                .andExpect(jsonPath("$.days[0].dayOfWeek").value(1));

        mockMvc.perform(put("/api/portal/staff/300/schedule")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"days\": [{\"dayOfWeek\": 1, \"startTime\": \"09:00:00\", \"endTime\": \"19:00:00\", \"isOff\": false}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testToggleStaffStatus_Success() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(barberRepository.save(any(Barber.class))).thenAnswer(i -> i.getArgument(0));

        mockMvc.perform(patch("/api/portal/staff/300/status")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"BREAK\", \"isActive\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(false));
    }

    @Test
    void testDeactivatedBarber_CannotReceiveWalkIn() throws Exception {
        barberAhmed.setIsActive(false);
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));

        mockMvc.perform(post("/api/portal/bookings/walk-in")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"customerName\": \"Tariq\", \"slotStart\": \"2026-10-15T10:00:00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Barber Inactive"));

        barberAhmed.setIsActive(true); // reset
    }

    @Test
    void testServices_CreateUpdateDelete() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(serviceItemRepository.save(any(ServiceItem.class))).thenAnswer(i -> {
            ServiceItem s = i.getArgument(0);
            s.setId(888L);
            return s;
        });
        when(serviceItemRepository.findById(888L)).thenReturn(Optional.of(serviceHaircut));

        // Create
        mockMvc.perform(post("/api/portal/services")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Hot Towel Shave\", \"category\": \"Beard & Shave\", \"price\": 45.0, \"durationMinutes\": 20, \"bufferMinutes\": 5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Hot Towel Shave"));

        // Update
        mockMvc.perform(put("/api/portal/services/888")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Hot Towel Shave Deluxe\", \"price\": 50.0}"))
                .andExpect(status().isOk());

        // Visibility
        mockMvc.perform(patch("/api/portal/services/888/visibility")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isVisible\": false}"))
                .andExpect(status().isOk());

        // Delete
        mockMvc.perform(delete("/api/portal/services/888")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testSalonSettings_GetAndUpdate() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(shopRepository.save(any(Shop.class))).thenAnswer(i -> i.getArgument(0));

        // Get
        mockMvc.perform(get("/api/portal/settings")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Elite Salon"))
                .andExpect(jsonPath("$.minCancelNoticeHours").value(2));

        // Update
        mockMvc.perform(put("/api/portal/settings")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Elite Salon & Spa\", \"minCancelNoticeHours\": 4, \"maxAdvanceBookingDays\": 21, \"autoConfirmWalkins\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testRevenueAnalytics_OwnerSuccess() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));

        RevenueAnalyticsDTO mockAnalytics = RevenueAnalyticsDTO.builder()
                .currency("SAR")
                .timezone("Asia/Riyadh")
                .todayEarnings(new BigDecimal("350.00"))
                .yesterdayEarnings(new BigDecimal("200.00"))
                .dailyPercentChange(75.0)
                .todayBookingsCount(5)
                .currentWeekEarnings(new BigDecimal("1800.00"))
                .totalCompletedRevenue(new BigDecimal("4500.00"))
                .totalCompletedBookings(15)
                .averageTicketSize(new BigDecimal("300.00"))
                .topStaff(RevenueAnalyticsDTO.TopStaffRevenueDTO.builder()
                        .staffId(300L)
                        .name("Ahmed Barber")
                        .specialty("Master Barber")
                        .totalRevenue(new BigDecimal("2500.00"))
                        .completedBookings(8)
                        .build())
                .build();

        when(salonAnalyticsService.calculateRevenueAnalytics(200L)).thenReturn(mockAnalytics);

        mockMvc.perform(get("/api/portal/analytics/revenue")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("SAR"))
                .andExpect(jsonPath("$.todayEarnings").value(350.00))
                .andExpect(jsonPath("$.topStaff.name").value("Ahmed Barber"));
    }

    @Test
    void testRevenueAnalytics_StaffForbidden() throws Exception {
        when(userRepository.findById(101L)).thenReturn(Optional.of(staffUser));

        mockMvc.perform(get("/api/portal/analytics/revenue")
                        .param("userId", "101"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Access Denied"));
    }

    @Test
    void testSalonGallery_GetAndUpload() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(salonImageRepository.countByShopId(200L)).thenReturn(2L);
        when(mediaStorageService.storeSalonGalleryImage(eq(200L), any())).thenReturn("/uploads/salons/200/gallery/photo1.webp");
        when(salonImageRepository.save(any(SalonImage.class))).thenAnswer(i -> {
            SalonImage img = i.getArgument(0);
            img.setId(88L);
            return img;
        });

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "salon_chair.webp",
                "image/webp",
                new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}
        );

        mockMvc.perform(multipart("/api/portal/gallery/upload")
                        .file(file)
                        .param("userId", "100")
                        .param("isCover", "true"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value("/uploads/salons/200/gallery/photo1.webp"))
                .andExpect(jsonPath("$.isCover").value(true));
    }

    @Test
    void testSalonGallery_UploadExceeds5_ReturnsBadRequest() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(salonImageRepository.countByShopId(200L)).thenReturn(5L); // Already at maximum of 5

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "salon6.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47}
        );

        mockMvc.perform(multipart("/api/portal/gallery/upload")
                        .file(file)
                        .param("userId", "100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Gallery Limit Reached"));
    }

    @Test
    void testStaffAvatar_UploadSuccess() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(shopRepository.findById(200L)).thenReturn(Optional.of(shop));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(mediaStorageService.storeStaffAvatar(eq(200L), eq(300L), any())).thenReturn("/uploads/salons/200/avatars/ahmed.jpg");
        when(barberRepository.save(any(Barber.class))).thenAnswer(i -> i.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.jpg",
                "image/jpeg",
                new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}
        );

        mockMvc.perform(multipart("/api/portal/staff/300/avatar")
                        .file(file)
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUrl").value("/uploads/salons/200/avatars/ahmed.jpg"))
                .andExpect(jsonPath("$.avatarUrl").value("/uploads/salons/200/avatars/ahmed.jpg"));
    }

    @Test
    void testStaffSchedule_BoundaryValidation_EndBeforeStart() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));

        // Invalid: endTime (08:00) is before startTime (09:00)
        mockMvc.perform(put("/api/portal/staff/300/schedule")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"days\": [{\"dayOfWeek\": 1, \"dayName\": \"Sunday\", \"startTime\": \"09:00:00\", \"endTime\": \"08:00:00\", \"isOff\": false}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid Shift Time"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("strictly after shift start time")));
    }

    @Test
    void testStaffSchedule_BoundaryValidation_BreakOutsideShift() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));

        // Invalid: break interval (18:00 - 19:00) is outside shift (09:00 - 17:00)
        mockMvc.perform(put("/api/portal/staff/300/schedule")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"barberId\": 300, \"days\": [{\"dayOfWeek\": 1, \"dayName\": \"Sunday\", \"startTime\": \"09:00:00\", \"endTime\": \"17:00:00\", \"breakStart\": \"18:00:00\", \"breakEnd\": \"19:00:00\", \"isOff\": false}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid Break Time"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Break intervals must fall within shift hours")));
    }

    @Test
    void testStaffStatus_DeactivationWithActiveBookings_Returns409Conflict() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findUpcomingActiveBookings(eq(200L), eq(300L), any(), any()))
                .thenReturn(List.of(sampleBooking));

        mockMvc.perform(patch("/api/portal/staff/300/status")
                        .param("userId", "100")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\": false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Active Bookings Conflict"))
                .andExpect(jsonPath("$.conflictCount").value(1))
                .andExpect(jsonPath("$.upcomingBookings").isArray());
    }

    @Test
    void testStaffDelete_WithActiveBookings_Returns409Conflict() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findUpcomingActiveBookings(eq(200L), eq(300L), any(), any()))
                .thenReturn(List.of(sampleBooking));

        mockMvc.perform(delete("/api/portal/staff/300")
                        .param("userId", "100"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Active Bookings Conflict"))
                .andExpect(jsonPath("$.conflictCount").value(1));
    }

    @Test
    void testStaffDelete_NoActiveBookings_SoftDeletesSuccessfully() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findUpcomingActiveBookings(eq(200L), eq(300L), any(), any()))
                .thenReturn(Collections.emptyList());
        when(barberRepository.save(any(Barber.class))).thenAnswer(i -> i.getArgument(0));

        mockMvc.perform(delete("/api/portal/staff/300")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Staff member removed successfully."));
    }

    @Test
    void testDirectStaffAvatar_UploadSuccess() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(mediaStorageService.storeStaffAvatar(eq(200L), any())).thenReturn("/uploads/salons/200/avatars/new_barber.webp");

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.webp",
                "image/webp",
                new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}
        );

        mockMvc.perform(multipart("/api/portal/staff/upload-avatar")
                        .file(file)
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.avatarUrl").value("/uploads/salons/200/avatars/new_barber.webp"));
    }

    @Test
    void testDirectStaffAvatar_Exceeds2MB_ReturnsBadRequest() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(mediaStorageService.storeStaffAvatar(eq(200L), any()))
                .thenThrow(new IllegalArgumentException("Avatar image size exceeds 2MB limit."));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large_avatar.png",
                "image/png",
                new byte[100]
        );

        mockMvc.perform(multipart("/api/portal/staff/upload-avatar")
                        .file(file)
                        .param("userId", "100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid File"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("exceeds 2MB limit")));
    }

    @Test
    void testGetUpcomingStaffBookings_Success() throws Exception {
        when(userRepository.findById(100L)).thenReturn(Optional.of(ownerUser));
        when(barberRepository.findById(300L)).thenReturn(Optional.of(barberAhmed));
        when(bookingRepository.findUpcomingActiveBookings(eq(200L), eq(300L), any(), any()))
                .thenReturn(List.of(sampleBooking));

        mockMvc.perform(get("/api/portal/staff/300/upcoming-bookings")
                        .param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(600));
    }
}
