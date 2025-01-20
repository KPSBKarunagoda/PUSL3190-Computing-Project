CREATE TABLE blacklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    added_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT DEFAULT NULL,
    detection_method VARCHAR(100) DEFAULT 'manual',
    detailed_explanation TEXT DEFAULT 'No detailed explanation provided.'
);