package com.vk.MentalWellness.repository;

import com.vk.MentalWellness.model.StressTrigger;
import com.vk.MentalWellness.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StressTriggerRepository extends JpaRepository<StressTrigger, Long> {
    List<StressTrigger> findByUserOrderByTimestampDesc(User user);
}
