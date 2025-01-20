const whois = require('whois');

function extractDomain(url) {
  // Remove protocol (http, https) and www if present
  const domain = url
    .replace(/^https?:\/\/(www\.)?/i, '')
    .split('/')[0];
  console.log(`Extracted domain: ${domain}`); // Debugging line
  return domain;
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
  console.log(`Domain for WHOIS lookup: ${domain}`); // Debugging line
  const creationDate = await getDomainCreationDate(domain);

  let riskScore = 0;
  let explanation = '';

  if (creationDate) {
    const domainAgeDays = Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
    if (domainAgeDays < 365) {
      riskScore = 70; // Higher risk for domains younger than a year
      explanation = 'The domain is less than a year old, which is often associated with phishing sites.';
    } else if (domainAgeDays < 1095) { // Between 1 and 3 years
      riskScore = 50; // Medium risk for domains between 1 and 3 years old
      explanation = 'The domain is between 1 and 3 years old, which is moderately risky.';
    } else {
      riskScore = 20; // Lower risk for well-established domains older than 3 years
      explanation = 'The domain is older than 3 years, which is generally safer.';
    }
  } else {
    riskScore = 50; // Medium risk if WHOIS data is unavailable
    explanation = 'WHOIS data is unavailable, which makes it harder to determine the risk.';
  }

  return { riskScore, explanation };
}

module.exports = { getRiskScore };