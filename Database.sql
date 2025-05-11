-- Database: `phishing_detector`

-- Table structure for table `user`
CREATE TABLE `user` (
  `UserID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(50) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `RegistrationDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `Role` enum('Admin','User') NOT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `UpdatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `Email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `activitylog`
CREATE TABLE `activitylog` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Action` varchar(50) NOT NULL,
  `UserID` int(11) DEFAULT NULL,
  `Details` text DEFAULT NULL,
  `Timestamp` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`ID`),
  KEY `UserID` (`UserID`),
  CONSTRAINT `activitylog_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `blacklist`
CREATE TABLE `blacklist` (
  `BlacklistID` int(11) NOT NULL AUTO_INCREMENT,
  `URL` varchar(255) NOT NULL,
  `Domain` varchar(255) NOT NULL,
  `AddedDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `AddedBy` int(11) NOT NULL,
  PRIMARY KEY (`BlacklistID`),
  KEY `AddedBy` (`AddedBy`),
  CONSTRAINT `blacklist_ibfk_1` FOREIGN KEY (`AddedBy`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `contact_submissions`
CREATE TABLE `contact_submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `user_id` varchar(100) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `submission_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('new','in_progress','completed') DEFAULT 'new',
  `is_read` tinyint(1) DEFAULT 0,
  `admin_notes` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `educationalcontent`
CREATE TABLE `educationalcontent` (
  `ContentID` int(11) NOT NULL AUTO_INCREMENT,
  `Title` varchar(255) NOT NULL,
  `Content` text NOT NULL,
  `CreatedDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `CreatedBy` int(11) NOT NULL,
  `BlacklistID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ContentID`),
  KEY `CreatedBy` (`CreatedBy`),
  KEY `BlacklistID` (`BlacklistID`),
  CONSTRAINT `educationalcontent_ibfk_1` FOREIGN KEY (`CreatedBy`) REFERENCES `user` (`UserID`),
  CONSTRAINT `educationalcontent_ibfk_2` FOREIGN KEY (`BlacklistID`) REFERENCES `blacklist` (`BlacklistID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add KeyFeatures column to EducationalContent table to store detected features
ALTER TABLE `educationalcontent` 
ADD COLUMN `KeyFeatures` JSON NULL AFTER `BlacklistID`;

-- Table structure for table `passwordreset`
CREATE TABLE `passwordreset` (
  `UserID` int(11) NOT NULL,
  `TokenHash` varchar(255) NOT NULL,
  `ExpiresAt` datetime NOT NULL,
  PRIMARY KEY (`UserID`),
  CONSTRAINT `passwordreset_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `reports`
CREATE TABLE `reports` (
  `ReportID` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` int(11) NOT NULL,
  `URL` varchar(255) NOT NULL,
  `ReportDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `Status` enum('Pending','Resolved') DEFAULT 'Pending',
  `Description` text DEFAULT NULL,
  `Reason` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`ReportID`),
  UNIQUE KEY `unique_user_url` (`UserID`,`URL`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `useractivity`
CREATE TABLE `useractivity` (
  `ActivityID` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` int(11) NOT NULL,
  `UrlHash` varchar(64) NOT NULL,
  `Title` varchar(255) DEFAULT NULL,
  `Risk` tinyint(4) DEFAULT NULL,
  `Timestamp` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`ActivityID`),
  UNIQUE KEY `UserID` (`UserID`,`UrlHash`),
  CONSTRAINT `useractivity_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `votes`
CREATE TABLE `votes` (
  `VoteID` int(11) NOT NULL AUTO_INCREMENT,
  `UserID` int(11) NOT NULL,
  `URL` varchar(255) NOT NULL,
  `VoteType` enum('Positive','Negative') NOT NULL,
  `Timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `PredictionShown` varchar(50) DEFAULT NULL,
  `PredictionScore` float DEFAULT NULL,
  PRIMARY KEY (`VoteID`),
  UNIQUE KEY `unique_user_url` (`UserID`,`URL`),
  CONSTRAINT `votes_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- Table structure for table `whitelist`
CREATE TABLE `whitelist` (
  `WhitelistID` int(11) NOT NULL AUTO_INCREMENT,
  `URL` varchar(255) NOT NULL,
  `Domain` varchar(255) NOT NULL,
  `AddedDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `AddedBy` int(11) NOT NULL,
  PRIMARY KEY (`WhitelistID`),
  KEY `AddedBy` (`AddedBy`),
  CONSTRAINT `whitelist_ibfk_1` FOREIGN KEY (`AddedBy`) REFERENCES `user` (`UserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;






-- Create admin account with email 'testUser@example.com' and password 'AdminPassword123!'
-- Note: This uses a pre-generated bcrypt hash. In production, generate a unique hash.
INSERT INTO User (Username, Email, PasswordHash, Role, Active) 
VALUES ('admin', 'testUser@example.com', '$2b$10$IEYIfVMivfLS0SroB2/t/eyGd7ayeJ3Rs2PpfWxypGFtC3yevK8N6', 'Admin', 1);
