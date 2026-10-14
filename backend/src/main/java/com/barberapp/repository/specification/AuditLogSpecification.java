package com.barberapp.repository.specification;

import com.barberapp.entity.AuditLog;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class AuditLogSpecification {

    public static Specification<AuditLog> filter(
            LocalDateTime startDate,
            LocalDateTime endDate,
            String action,
            Long shopId,
            String search
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }

            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }

            if (StringUtils.hasText(action) && !"ALL".equalsIgnoreCase(action.trim())) {
                predicates.add(cb.equal(cb.upper(root.get("action")), action.trim().toUpperCase()));
            }

            if (shopId != null && shopId > 0) {
                predicates.add(cb.equal(root.get("shop").get("id"), shopId));
            }

            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate detailsMatch = cb.like(cb.lower(root.get("details")), pattern);
                Predicate actionMatch = cb.like(cb.lower(root.get("action")), pattern);
                Predicate ipMatch = cb.like(cb.lower(root.get("ipAddress")), pattern);

                Join<AuditLog, User> userJoin = root.join("user", JoinType.LEFT);
                Predicate userEmailMatch = cb.like(cb.lower(userJoin.get("email")), pattern);
                Predicate userNameMatch = cb.like(cb.lower(userJoin.get("fullName")), pattern);

                Join<AuditLog, Shop> shopJoin = root.join("shop", JoinType.LEFT);
                Predicate shopNameMatch = cb.like(cb.lower(shopJoin.get("name")), pattern);

                predicates.add(cb.or(detailsMatch, actionMatch, ipMatch, userEmailMatch, userNameMatch, shopNameMatch));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}

