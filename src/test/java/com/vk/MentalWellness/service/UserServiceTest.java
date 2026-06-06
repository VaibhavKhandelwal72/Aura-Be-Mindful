package com.vk.MentalWellness.service;

import com.vk.MentalWellness.model.User;
import com.vk.MentalWellness.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserServiceTest {

    private UserService userService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        userService = new UserService(userRepository, passwordEncoder);
    }

    @Test
    void testRegisterUser_Success() {
        String username = "student1";
        String password = "plainpassword";
        String examType = "JEE";

        when(userRepository.existsByUsername(username)).thenReturn(false);
        when(passwordEncoder.encode(password)).thenReturn("hashedpassword");
        
        User mockUser = User.builder()
                .username(username)
                .password("hashedpassword")
                .examType(examType)
                .build();
        when(userRepository.save(any(User.class))).thenReturn(mockUser);

        User registeredUser = userService.registerUser(username, password, examType);

        assertNotNull(registeredUser);
        assertEquals(username, registeredUser.getUsername());
        assertEquals("hashedpassword", registeredUser.getPassword());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void testRegisterUser_DuplicateUsername_ThrowsException() {
        String username = "duplicate";
        when(userRepository.existsByUsername(username)).thenReturn(true);

        Exception exception = assertThrows(IllegalArgumentException.class, () -> {
            userService.registerUser(username, "password123", "NEET");
        });

        assertEquals("Username is already taken", exception.getMessage());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void testLoadUserByUsername_Success() {
        String username = "testuser";
        User mockUser = User.builder()
                .username(username)
                .password("hashedpassword")
                .examType("BOARDS")
                .build();

        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));

        UserDetails userDetails = userService.loadUserByUsername(username);

        assertNotNull(userDetails);
        assertEquals(username, userDetails.getUsername());
        assertEquals("hashedpassword", userDetails.getPassword());
    }

    @Test
    void testLoadUserByUsername_NotFound_ThrowsException() {
        String username = "nonexistent";
        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class, () -> {
            userService.loadUserByUsername(username);
        });
    }
}
