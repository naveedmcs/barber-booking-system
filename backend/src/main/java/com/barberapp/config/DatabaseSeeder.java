package com.barberapp.config;

import com.barberapp.entity.AuditLog;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.entity.enums.SubscriptionPlan;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.AuditLogRepository;
import com.barberapp.repository.ShopRepository;
import com.barberapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final AuditLogRepository auditLogRepository;
    private final com.barberapp.repository.BarberRepository barberRepository;
    private final com.barberapp.repository.CustomerRepository customerRepository;
    private final com.barberapp.repository.ServiceItemRepository serviceItemRepository;
    private final com.barberapp.repository.BookingRepository bookingRepository;
    private final com.barberapp.repository.WorkingHoursRepository workingHoursRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Seed Super Admin if missing
        if (userRepository.findByEmail("admin@barberapp.sa").isEmpty()) {
            User admin = User.builder()
                    .email("admin@barberapp.sa")
                    .password(passwordEncoder.encode("Admin123!"))
                    .fullName("Super Administrator")
                    .role(UserRole.SUPER_ADMIN)
                    .phone("0500000000")
                    .active(true)
                    .build();
            userRepository.save(admin);
            log.info("Seeded Super Admin user: admin@barberapp.sa");
        }

        // Seed Support Agent if missing
        if (userRepository.findByEmail("support@barberapp.sa").isEmpty()) {
            User support = User.builder()
                    .email("support@barberapp.sa")
                    .password(passwordEncoder.encode("Support123!"))
                    .fullName("Tariq Al-Harbi")
                    .role(UserRole.SUPPORT_AGENT)
                    .phone("0551122334")
                    .active(true)
                    .build();
            userRepository.save(support);
            log.info("Seeded Support Agent user: support@barberapp.sa");
        }

        // Seed Audit Inspector if missing
        if (userRepository.findByEmail("inspector@barberapp.sa").isEmpty()) {
            User inspector = User.builder()
                    .email("inspector@barberapp.sa")
                    .password(passwordEncoder.encode("Inspector123!"))
                    .fullName("Noura Al-Dosari")
                    .role(UserRole.AUDIT_INSPECTOR)
                    .phone("0559988776")
                    .active(true)
                    .build();
            userRepository.save(inspector);
            log.info("Seeded Audit Inspector user: inspector@barberapp.sa");
        }

        // Seed Salon Owner 1 (Golden Scissors)
        User owner1 = userRepository.findByEmail("owner@goldenscissors.sa").orElse(null);
        if (owner1 == null) {
            owner1 = User.builder()
                    .email("owner@goldenscissors.sa")
                    .password(passwordEncoder.encode("Owner123!"))
                    .fullName("Tariq Al-Mansoor")
                    .role(UserRole.SALON_OWNER)
                    .phone("0501234567")
                    .active(true)
                    .build();
            owner1 = userRepository.save(owner1);
            log.info("Seeded Salon Owner 1: owner@goldenscissors.sa");
        }

        // Create Shop 1 if missing
        Shop shop1 = shopRepository.findBySlug("golden-scissors").orElse(null);
        if (shop1 == null) {
            shop1 = Shop.builder()
                    .owner(owner1)
                    .name("Golden Scissors Salon")
                    .slug("golden-scissors")
                    .phone("0501234567")
                    .region("Riyadh Region")
                    .district("Olaya")
                    .city("Riyadh")
                    .fullAddress("King Fahd Road, Building 42, Olaya")
                    .mapAddress("7JQC+RP Riyadh")
                    .subscriptionPlan(SubscriptionPlan.MONTHLY)
                    .status(com.barberapp.entity.enums.ShopStatus.ACTIVE)
                    .build();
            shop1 = shopRepository.save(shop1);
        }

        if (owner1 != null && shop1 != null && owner1.getSalonId() == null) {
            owner1.setSalonId(shop1.getId());
            userRepository.save(owner1);
        }

        // Seed Salon Owner 2 (Royal Barber Lounge)
        User owner2 = userRepository.findByEmail("owner@royallounge.sa").orElse(null);
        if (owner2 == null) {
            owner2 = User.builder()
                    .email("owner@royallounge.sa")
                    .password(passwordEncoder.encode("Owner123!"))
                    .fullName("Fahad Mansoor")
                    .role(UserRole.SALON_OWNER)
                    .phone("0509876543")
                    .active(true)
                    .build();
            owner2 = userRepository.save(owner2);
            log.info("Seeded Salon Owner 2: owner@royallounge.sa");
        }

        Shop shop2 = shopRepository.findBySlug("royal-barber-lounge").orElse(null);
        if (shop2 == null) {
            shop2 = Shop.builder()
                    .owner(owner2)
                    .name("Royal Barber Lounge")
                    .slug("royal-barber-lounge")
                    .phone("0509876543")
                    .region("Makkah Region")
                    .district("Al-Hamra")
                    .city("Jeddah")
                    .fullAddress("Corniche Road, Building 18")
                    .mapAddress("8HPR+2M Jeddah")
                    .subscriptionPlan(SubscriptionPlan.YEARLY)
                    .status(com.barberapp.entity.enums.ShopStatus.ACTIVE)
                    .build();
            shop2 = shopRepository.save(shop2);
        }

        if (owner2 != null && shop2 != null && owner2.getSalonId() == null) {
            owner2.setSalonId(shop2.getId());
            userRepository.save(owner2);
        }

        // Seed Salon Owner 3 (Al-Ghamdi Luxury Grooming)
        User owner3 = userRepository.findByEmail("owner@alghamdi.sa").orElse(null);
        if (owner3 == null) {
            owner3 = User.builder()
                    .email("owner@alghamdi.sa")
                    .password(passwordEncoder.encode("Owner123!"))
                    .fullName("Abdulrahman Al-Ghamdi")
                    .role(UserRole.SALON_OWNER)
                    .phone("0541122334")
                    .active(true)
                    .build();
            owner3 = userRepository.save(owner3);
            log.info("Seeded Salon Owner 3: owner@alghamdi.sa");
        }

        Shop shop3 = shopRepository.findBySlug("al-ghamdi-luxury-grooming").orElse(null);
        if (shop3 == null) {
            shop3 = Shop.builder()
                    .owner(owner3)
                    .name("Al-Ghamdi Luxury Grooming")
                    .slug("al-ghamdi-luxury-grooming")
                    .phone("0541122334")
                    .region("Eastern Province")
                    .district("Al-Shati")
                    .city("Dammam")
                    .fullAddress("Prince Mohammed Bin Fahd Road, Al-Shati, Dammam")
                    .mapAddress("Dammam Corniche")
                    .subscriptionPlan(SubscriptionPlan.MONTHLY)
                    .status(com.barberapp.entity.enums.ShopStatus.ACTIVE)
                    .build();
            shop3 = shopRepository.save(shop3);
        }
        if (owner3 != null && shop3 != null && owner3.getSalonId() == null) {
            owner3.setSalonId(shop3.getId());
            userRepository.save(owner3);
        }

        // Seed Salon Owner 4 (Al-Raqaqah Executive Grooming)
        User owner4 = userRepository.findByEmail("owner@alraqaqah.sa").orElse(null);
        if (owner4 == null) {
            owner4 = User.builder()
                    .email("owner@alraqaqah.sa")
                    .password(passwordEncoder.encode("Owner123!"))
                    .fullName("Majed Al-Mutairi")
                    .role(UserRole.SALON_OWNER)
                    .phone("0567788990")
                    .active(true)
                    .build();
            owner4 = userRepository.save(owner4);
            log.info("Seeded Salon Owner 4: owner@alraqaqah.sa");
        }

        Shop shop4 = shopRepository.findBySlug("al-raqaqah-executive-grooming").orElse(null);
        if (shop4 == null) {
            shop4 = Shop.builder()
                    .owner(owner4)
                    .name("Al-Raqaqah Executive Grooming")
                    .slug("al-raqaqah-executive-grooming")
                    .phone("0567788990")
                    .region("Riyadh Region")
                    .district("Al-Nakheel")
                    .city("Riyadh")
                    .fullAddress("Northern Ring Branch Rd, Al-Nakheel, Riyadh")
                    .mapAddress("Al-Nakheel Plaza")
                    .subscriptionPlan(SubscriptionPlan.YEARLY)
                    .status(com.barberapp.entity.enums.ShopStatus.ACTIVE)
                    .build();
            shop4 = shopRepository.save(shop4);
        }
        if (owner4 != null && shop4 != null && owner4.getSalonId() == null) {
            owner4.setSalonId(shop4.getId());
            userRepository.save(owner4);
        }

        // Seed Salon Owner 5 (Salon 1 hair Cut)
        User owner5 = userRepository.findByEmail("owner@salon1.sa").orElse(null);
        if (owner5 == null) {
            owner5 = User.builder()
                    .email("owner@salon1.sa")
                    .password(passwordEncoder.encode("Owner123!"))
                    .fullName("Rami Haddad")
                    .role(UserRole.SALON_OWNER)
                    .phone("0534455667")
                    .active(true)
                    .build();
            owner5 = userRepository.save(owner5);
            log.info("Seeded Salon Owner 5: owner@salon1.sa");
        }

        Shop shop5 = shopRepository.findBySlug("salon-1-hair-cut").orElse(null);
        if (shop5 == null) {
            shop5 = Shop.builder()
                    .owner(owner5)
                    .name("Salon 1 hair Cut")
                    .slug("salon-1-hair-cut")
                    .phone("0534455667")
                    .region("Makkah Region")
                    .district("Al-Rawdah")
                    .city("Jeddah")
                    .fullAddress("Al Kayyal St, Al-Rawdah, Jeddah")
                    .mapAddress("Al-Rawdah Commercial")
                    .subscriptionPlan(SubscriptionPlan.MONTHLY)
                    .status(com.barberapp.entity.enums.ShopStatus.ACTIVE)
                    .build();
            shop5 = shopRepository.save(shop5);
        }
        if (owner5 != null && shop5 != null && owner5.getSalonId() == null) {
            owner5.setSalonId(shop5.getId());
            userRepository.save(owner5);
        }

        if (shop1 != null) {
            // Seed Salon Staff 1 (Ahmed - Golden Scissors)
            User staffAhmed = userRepository.findByEmail("staff@goldenscissors.sa").orElse(null);
            if (staffAhmed == null) {
                staffAhmed = User.builder()
                        .email("staff@goldenscissors.sa")
                        .password(passwordEncoder.encode("Staff123!"))
                        .fullName("Ahmed Al-Ghamdi (Barber)")
                        .role(UserRole.SALON_STAFF)
                        .phone("0553344556")
                        .salonId(shop1.getId())
                        .active(true)
                        .build();
                staffAhmed = userRepository.save(staffAhmed);
                log.info("Seeded Salon Staff 1: staff@goldenscissors.sa");
            }

            // Seed Salon Staff 2 (Sami - Golden Scissors)
            User staffSami = userRepository.findByEmail("sami@goldenscissors.sa").orElse(null);
            if (staffSami == null) {
                staffSami = User.builder()
                        .email("sami@goldenscissors.sa")
                        .password(passwordEncoder.encode("Staff123!"))
                        .fullName("Sami Al-Otaibi (Barber)")
                        .role(UserRole.SALON_STAFF)
                        .phone("0556677889")
                        .salonId(shop1.getId())
                        .active(true)
                        .build();
                staffSami = userRepository.save(staffSami);
                log.info("Seeded Salon Staff 2: sami@goldenscissors.sa");
            }

            // Link / Seed Barbers for Shop 1
            com.barberapp.entity.Barber barberAhmed = barberRepository.findByShopId(shop1.getId()).stream()
                    .filter(b -> b.getName().contains("Ahmed"))
                    .findFirst()
                    .orElse(null);
            if (barberAhmed == null) {
                barberAhmed = com.barberapp.entity.Barber.builder()
                        .shop(shop1)
                        .user(staffAhmed)
                        .name("Master Barber Ahmed")
                        .specialty("Master Barber & Fade Specialist")
                        .phone("0553344556")
                        .email("staff@goldenscissors.sa")
                        .status("ACTIVE")
                        .isActive(true)
                        .build();
                barberAhmed = barberRepository.save(barberAhmed);
            } else {
                if (barberAhmed.getUser() == null && staffAhmed != null) barberAhmed.setUser(staffAhmed);
                if (barberAhmed.getSpecialty() == null) barberAhmed.setSpecialty("Master Barber & Fade Specialist");
                if (barberAhmed.getPhone() == null) barberAhmed.setPhone("0553344556");
                if (barberAhmed.getEmail() == null) barberAhmed.setEmail("staff@goldenscissors.sa");
                if (barberAhmed.getStatus() == null) barberAhmed.setStatus("ACTIVE");
                if (barberAhmed.getIsActive() == null) barberAhmed.setIsActive(true);
                barberAhmed = barberRepository.save(barberAhmed);
            }

            com.barberapp.entity.Barber barberSami = barberRepository.findByShopId(shop1.getId()).stream()
                    .filter(b -> b.getName().contains("Sami"))
                    .findFirst()
                    .orElse(null);
            if (barberSami == null) {
                barberSami = com.barberapp.entity.Barber.builder()
                        .shop(shop1)
                        .user(staffSami)
                        .name("Sami Al-Otaibi")
                        .specialty("Senior Stylist & Beard Sculptor")
                        .phone("0556677889")
                        .email("sami@goldenscissors.sa")
                        .status("ACTIVE")
                        .isActive(true)
                        .build();
                barberSami = barberRepository.save(barberSami);
            } else {
                if (barberSami.getUser() == null && staffSami != null) barberSami.setUser(staffSami);
                if (barberSami.getSpecialty() == null) barberSami.setSpecialty("Senior Stylist & Beard Sculptor");
                if (barberSami.getPhone() == null) barberSami.setPhone("0556677889");
                if (barberSami.getEmail() == null) barberSami.setEmail("sami@goldenscissors.sa");
                if (barberSami.getStatus() == null) barberSami.setStatus("ACTIVE");
                if (barberSami.getIsActive() == null) barberSami.setIsActive(true);
                barberSami = barberRepository.save(barberSami);
            }

            // Seed Working Hours for Ahmed & Sami if empty
            if (workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(barberAhmed.getId()).isEmpty()) {
                seedBarberHours(barberAhmed);
            }
            if (workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(barberSami.getId()).isEmpty()) {
                seedBarberHours(barberSami);
            }

            // Seed Services for Shop 1 if missing
            com.barberapp.entity.ServiceItem service1 = serviceItemRepository.findByShopId(shop1.getId()).stream().findFirst().orElse(null);
            if (service1 == null) {
                service1 = com.barberapp.entity.ServiceItem.builder()
                        .shop(shop1)
                        .name("Royal Haircut & Hot Towel")
                        .category("Haircut")
                        .durationMinutes(30)
                        .bufferMinutes(5)
                        .price(new java.math.BigDecimal("60.00"))
                        .description("Precision haircut, hot towel, and styling")
                        .isVisible(true)
                        .assignedStaffIds("ALL")
                        .build();
                service1 = serviceItemRepository.save(service1);

                com.barberapp.entity.ServiceItem service2 = com.barberapp.entity.ServiceItem.builder()
                        .shop(shop1)
                        .name("Beard Sculpting & Razor Line")
                        .category("Beard & Shave")
                        .durationMinutes(25)
                        .bufferMinutes(5)
                        .price(new java.math.BigDecimal("40.00"))
                        .description("Razor line-up with premium beard balm")
                        .isVisible(true)
                        .assignedStaffIds("ALL")
                        .build();
                serviceItemRepository.save(service2);

                com.barberapp.entity.ServiceItem service3 = com.barberapp.entity.ServiceItem.builder()
                        .shop(shop1)
                        .name("Charcoal Facial & Detox Mask")
                        .category("Facial & Spa")
                        .durationMinutes(20)
                        .bufferMinutes(5)
                        .price(new java.math.BigDecimal("35.00"))
                        .description("Deep pore cleansing with mineral clay mask")
                        .isVisible(true)
                        .assignedStaffIds("ALL")
                        .build();
                serviceItemRepository.save(service3);
            }

            // Seed Customers & Bookings if missing
            if (bookingRepository.findByShopId(shop1.getId()).isEmpty()) {
                com.barberapp.entity.Customer customer1 = com.barberapp.entity.Customer.builder()
                        .fullName("Khalid Al-Amri")
                        .phone("0501112233")
                        .email("khalid@client.sa")
                        .build();
                customer1 = customerRepository.save(customer1);

                com.barberapp.entity.Customer customer2 = com.barberapp.entity.Customer.builder()
                        .fullName("Bandar Al-Harbi")
                        .phone("0502223344")
                        .email("bandar@client.sa")
                        .build();
                customer2 = customerRepository.save(customer2);

                LocalDateTime now = LocalDateTime.now().withMinute(0).withSecond(0).withNano(0);

                // Booking for Ahmed
                bookingRepository.save(com.barberapp.entity.Booking.builder()
                        .shop(shop1)
                        .barber(barberAhmed)
                        .service(service1)
                        .customer(customer1)
                        .slotStart(now.plusHours(1))
                        .slotEnd(now.plusHours(1).plusMinutes(30))
                        .status(com.barberapp.entity.enums.BookingStatus.CONFIRMED)
                        .build());

                // Booking for Sami
                bookingRepository.save(com.barberapp.entity.Booking.builder()
                        .shop(shop1)
                        .barber(barberSami)
                        .service(service1)
                        .customer(customer2)
                        .slotStart(now.plusHours(2))
                        .slotEnd(now.plusHours(2).plusMinutes(30))
                        .status(com.barberapp.entity.enums.BookingStatus.CONFIRMED)
                        .build());

                log.info("Seeded initial bookings for shop1 with staff isolation.");
            }
        }

        // Seed Audit Logs if empty
        if (auditLogRepository.count() == 0) {
            User adminUser = userRepository.findByEmail("admin@barberapp.sa").orElse(null);

            auditLogRepository.save(AuditLog.builder()
                    .user(adminUser)
                    .shop(shop1)
                    .action("LOGIN")
                    .details("{\"eventType\": \"AUTH_LOGIN_SUCCESS\", \"method\": \"PASSWORD\", \"userAgent\": \"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)\", \"device\": \"Desktop Chrome\", \"status\": \"SUCCESS\"}")
                    .ipAddress("127.0.0.1")
                    .createdAt(LocalDateTime.now().minusHours(1))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(owner1)
                    .shop(shop1)
                    .action("UPDATE_SALON")
                    .details("{\"shopSlug\": \"golden-scissors\", \"fieldsUpdated\": [\"phone\", \"working_hours\"], \"previousPhone\": \"0501110000\", \"newPhone\": \"0501234567\", \"updatedBy\": \"owner@goldenscissors.sa\"}")
                    .ipAddress("192.168.1.45")
                    .createdAt(LocalDateTime.now().minusHours(3))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(adminUser)
                    .shop(shop1)
                    .action("DELETE_STAFF")
                    .details("{\"targetBarberId\": 4, \"targetBarberName\": \"Zaid Al-Harbi\", \"shopId\": 1, \"shopName\": \"Golden Scissors Salon\", \"reason\": \"Staff contract concluded\", \"approvedBy\": \"admin@barberapp.sa\"}")
                    .ipAddress("192.168.1.1")
                    .createdAt(LocalDateTime.now().minusHours(6))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(adminUser)
                    .shop(shop1)
                    .action("SHOP_AUTO_APPROVED")
                    .details("{\"transactionId\": \"tx_moyasar_99812\", \"amount\": 20.00, \"currency\": \"SAR\", \"provider\": \"MOYASAR\", \"status\": \"SUCCESS\", \"plan\": \"MONTHLY\"}")
                    .ipAddress("192.168.1.1")
                    .createdAt(LocalDateTime.now().minusDays(1))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(owner1)
                    .shop(shop1)
                    .action("SHOP_REGISTERED")
                    .details("{\"shopName\": \"Golden Scissors Salon\", \"ownerEmail\": \"owner@goldenscissors.sa\", \"city\": \"Riyadh\", \"plan\": \"MONTHLY\", \"barbersInitial\": 3, \"servicesInitial\": 3}")
                    .ipAddress("172.16.0.22")
                    .createdAt(LocalDateTime.now().minusDays(2))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(owner2)
                    .shop(shop2)
                    .action("LOGIN")
                    .details("{\"eventType\": \"AUTH_LOGIN_SUCCESS\", \"method\": \"PASSWORD\", \"userAgent\": \"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)\", \"device\": \"Mobile Safari\", \"status\": \"SUCCESS\"}")
                    .ipAddress("192.168.1.89")
                    .createdAt(LocalDateTime.now().minusHours(12))
                    .build());

            auditLogRepository.save(AuditLog.builder()
                    .user(adminUser)
                    .shop(shop2)
                    .action("UPDATE_SALON")
                    .details("{\"shopSlug\": \"royal-barber-lounge\", \"action\": \"STATUS_OVERRIDE\", \"previousStatus\": \"PENDING\", \"newStatus\": \"ACTIVE\", \"reason\": \"Manual compliance review approved\"}")
                    .ipAddress("127.0.0.1")
                    .createdAt(LocalDateTime.now().minusDays(3))
                    .build());

            log.info("Seeded initial audit logs into audit_logs table.");
        }
    }

    private void seedBarberHours(com.barberapp.entity.Barber barber) {
        for (int day = 1; day <= 7; day++) {
            boolean isOff = (day == 6);
            com.barberapp.entity.WorkingHours wh = com.barberapp.entity.WorkingHours.builder()
                    .barber(barber)
                    .dayOfWeek(day)
                    .startTime(java.time.LocalTime.of(9, 0))
                    .endTime(java.time.LocalTime.of(21, 0))
                    .isOff(isOff)
                    .breakStart(isOff ? null : java.time.LocalTime.of(13, 0))
                    .breakEnd(isOff ? null : java.time.LocalTime.of(14, 0))
                    .build();
            workingHoursRepository.save(wh);
        }
    }
}
