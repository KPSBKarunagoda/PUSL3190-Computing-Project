const whois = require('whois');

function extractDomain(url) {
  const domain = url
    .replace(/^https?:\/\/(www\.)?/i, '')
    .split('/')[0];
  console.log(`Extracted domain: ${domain}`);
  return domain;
}

function hasHTTPS(url) {
  return url.toLowerCase().startsWith('https://');
}

function getDomainCreationDate(domain) {
  return new Promise((resolve, reject) => {
    whois.lookup(domain, (err, data) => {
      if (err) {
        return reject(err);
      }
      const match = data.match(/(Creation Date|Created On|Registered on):?\s+(.*)/i);
      if (match && match[2]) {
        resolve(new Date(match[2]));
      } else {
        resolve(null);
      }
    });
  });
}

async function getRiskScore(url) {
  const domain = extractDomain(url);
  console.log(`Domain for WHOIS lookup: ${domain}`);
  const creationDate = await getDomainCreationDate(domain);

  let riskScore = 0;
  let explanations = [];

  // Domain age check
  if (creationDate) {
    const domainAgeDays = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
    if (domainAgeDays < 365) {
      riskScore += 70;
      explanations.push('The domain is less than a year old, which is often associated with phishing sites.');
    } else if (domainAgeDays < 1095) {
      riskScore += 50;
      explanations.push('The domain is between 1 and 3 years old, which is moderately risky.');
    } else {
      riskScore += 20;
      explanations.push('The domain is older than 3 years, which is generally safer.');
    }
  } else {
    riskScore += 50;
    explanations.push('WHOIS data is unavailable, which makes it harder to determine the risk.');
  }

  // HTTPS check
  if (!hasHTTPS(url)) {
    riskScore += 30;
    explanations.push('The site does not use HTTPS, which is a security risk.');
  }

  return {
    riskScore: Math.min(100, riskScore),
    explanation: explanations.join(' ')
  };
}

module.exports = { getRiskScore };