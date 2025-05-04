# PhishGuard - Advanced Phishing Detection and Web Security Platform


## 🛡️ Overview

PhishGuard is a comprehensive web security platform designed to protect users from phishing attacks using advanced machine learning algorithms and multi-layered security analysis. The system helps users identify potentially malicious URLs, analyze email headers for phishing indicators, and manage their online security through an intuitive interface.

## ✨ Key Features

- **Real-time URL Analysis**: Scan any URL to detect phishing attempts using our advanced machine learning model
- **Email Header Analysis**: Identify phishing attempts in emails by analyzing email headers
- **Password Security Check**: Verify the strength and security of your passwords
- **Security Dashboard**: Monitor your security status and past scan activities
- **Chrome Extension**: Quick access to scanning features directly from your browser
- **AI-Powered Analysis**: Get detailed explanations of security threats using our integrated AI system
- **Community-Based Voting**: Contribute to the security database by voting on URL safety
- **User Reporting System**: Report suspected phishing sites to help protect the community

## 🧠 Technology Stack

### Frontend
- HTML5, CSS3, JavaScript
- Chrome Extension API
- Chart.js for data visualization
- Responsive web design

### Backend
- Node.js with Express.js
- MySQL database
- Python for machine learning components
- JWT for authentication

### Security Features
- Machine Learning-based classification (LightGBM)
- Google Safe Browsing API integration
- URL feature extraction and analysis
- SPF, DKIM and DMARC verification for email analysis
- Blacklist and whitelist databases

## 📊 URL Analysis Methodology

PhishGuard employs a sophisticated four-step analysis process:

1. **Blacklist Check**: Compares against known malicious domains
2. **Whitelist Check**: Validates against trusted domains
3. **Safe Browsing API**: Queries Google's Safe Browsing database
4. **ML Analysis**: Extracts 50+ features from the URL and applies our trained machine learning model

The risk score is calculated using a weighted algorithm that considers:
- Domain age and registration information
- URL structure and characteristics
- SSL/TLS certificate status
- Redirect patterns
- Google indexing status
- IP-based hosting detection
- And many other security indicators

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v14.0+) - [Download](https://nodejs.org/)
- **Python** (v3.8+) - [Download](https://www.python.org/downloads/)
- **MySQL** (v8.0+) - [Download](https://dev.mysql.com/downloads/mysql/) or **XAMPP** - [Download](https://www.apachefriends.org/download.html)
- **Git** - [Download](https://git-scm.com/downloads)
- **Chrome Browser** (for extension) - [Download](https://www.google.com/chrome/)

### Installation

1. Clone the repository
```
git clone https://github.com/KPSBKarunagoda/PUSL3190-Computing-Project.git
```

2. Install Node.js dependencies
```
cd PUSL3190-Computing-Project
npm install
```

This will install all required Node.js packages:
- axios
- cors
- express
- mysql2

3. Install Python dependencies
```
pip install -r requirements.txt
```

This will install all Python dependencies:
- pandas
- numpy
- scikit-learn
- lightgbm
- requests
- dnspython
- python-whois
- pyOpenSSL
- python-dotenv
- matplotlib
- seaborn
- joblib
- google-generativeai

4. Set up the database (MySQL)
```
mysql -u username -p < database/schema.sql
```

Or if using XAMPP:
- Start Apache and MySQL from the XAMPP Control Panel
- Open http://localhost/phpmyadmin in your browser
- Create a new database named 'phishing_detector'
- Either import the schema.sql file or run the application once to auto-create tables

5. Configure environment variables
```
cp .env.example .env
# Edit .env with your configuration
```

6. Start the server
```
npm start
```

### Chrome Extension Installation

1. Open Chrome and navigate to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked" and select the "frontend" directory
4. The PhishGuard icon should appear in your browser toolbar

## 👥 Admin Dashboard

PhishGuard includes a comprehensive admin dashboard to manage:

- User accounts and permissions
- Blacklist and whitelist databases
- Security reports submitted by users
- Community voting statistics
- Phishing trends and stats
- Contact Us inquiries

## 🔗 Contact

KPSB Karuangoda-10899226 <br>
10899226@students.plymouth.ac.uk


# Socials  

Linkdin - https://www.linkedin.com/in/sanuth-karunagoda/ <br>
Instagram - https://www.instagram.com/sanuth.karunagoda?igsh=eWRjd2lzaTNheDlv&utm_source=qr

---


