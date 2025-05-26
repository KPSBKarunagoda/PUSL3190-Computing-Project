import socket
import asyncio
import sys
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

class IPReputationService:
    """Service to check IP reputation against known blocklists"""
    
    def __init__(self):
        # Common DNS blocklists (DNSBLs)
        self.blocklists = [
            'zen.spamhaus.org',       # Spamhaus (high reputation)
            'bl.spamcop.net',         # SpamCop
            'dnsbl.sorbs.net',        # SORBS
            'xbl.spamhaus.org',       # Spamhaus XBL (exploits/malware)
            'sbl.spamhaus.org',       # Spamhaus SBL
            'b.barracudacentral.org', # Barracuda
            'cbl.abuseat.org',        # Composite Blocking List
        ]
        
        # Cache results to avoid repeated lookups
        self.cache = {}
        
    async def check_ip_reputation(self, url_or_ip: str) -> Dict[str, Any]:
        """
        Check if the IP of a domain is on any known blocklists
        Returns dict with results and risk score contribution
        """
        try:
            # Extract domain from URL if given
            domain = self._extract_domain(url_or_ip)
            if not domain:
                return {"listed": False, "risk_score": 0, "message": "Invalid domain or IP"}
                
            # Resolve domain to IP
            ip = await self._resolve_domain_to_ip(domain)
            if not ip:
                return {"listed": False, "risk_score": 0, "message": "Could not resolve domain to IP"}
                
            # Check cache first
            cache_key = f"{domain}:{ip}"
            if cache_key in self.cache:
                return self.cache[cache_key]
                
            # Check the IP against blocklists
            listed_blocklists = await self._check_ip_against_blocklists(ip)
            
            # Calculate risk score based on found listings
            risk_score = self._calculate_risk_score(listed_blocklists)
            
            result = {
                "domain": domain,
                "ip": ip,
                "listed": bool(listed_blocklists),
                "risk_score": risk_score,
                "blocklists": listed_blocklists,
                "message": f"IP {ip} found on {len(listed_blocklists)} blocklists" if listed_blocklists else f"IP {ip} not found on any blocklists"
            }
            
            # Cache the result
            self.cache[cache_key] = result
            return result
            
        except Exception as e:
            print(f"Error checking IP reputation: {str(e)}", file=sys.stderr)
            return {"listed": False, "risk_score": 0, "message": f"Error checking IP reputation: {str(e)}"}
            
    def _extract_domain(self, url_or_ip: str) -> Optional[str]:
        """Extract domain from URL or return IP if given"""
        # Check if input is already an IP
        try:
            socket.inet_aton(url_or_ip)  # Will raise error if not valid IP
            return url_or_ip  # It's an IP
        except:
            pass
            
        # Try to parse as URL
        try:
            parsed_url = urlparse(url_or_ip)
            domain = parsed_url.netloc
            if not domain:
                domain = parsed_url.path
                
            # Remove port if present
            if ':' in domain:
                domain = domain.split(':')[0]
                
            return domain
        except:
            return None
            
    async def _resolve_domain_to_ip(self, domain: str) -> Optional[str]:
        """Resolve domain to IP address"""
        try:
            # If it's already an IP, return it
            try:
                socket.inet_aton(domain)
                return domain
            except:
                pass
                
            # Use async DNS resolution
            loop = asyncio.get_event_loop()
            ip_address = await loop.run_in_executor(None, socket.gethostbyname, domain)
            return ip_address
        except Exception as e:
            print(f"Failed to resolve {domain}: {e}", file=sys.stderr)
            return None
    
    async def _check_ip_against_blocklists(self, ip: str) -> List[str]:
        """Check if IP is listed on any blocklists"""
        listed_on = []
        
        # Reverse the IP for DNSBL lookups
        octets = ip.split('.')
        reversed_ip = '.'.join(octets[::-1])
        
        # Check each blocklist with small delay to avoid overwhelming DNS
        for blocklist in self.blocklists:
            try:
                # Construct the DNSBL lookup hostname
                lookup = f"{reversed_ip}.{blocklist}"
                
                try:
                    # If this resolves, the IP is listed
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, socket.gethostbyname, lookup)
                    listed_on.append(blocklist)
                    print(f"IP {ip} is listed on {blocklist}", file=sys.stderr)
                except socket.error:
                    # Not listed
                    pass
                    
                # Brief pause between lookups
                await asyncio.sleep(0.1)
                
            except Exception as e:
                print(f"Error checking {blocklist}: {e}", file=sys.stderr)
                
        return listed_on
        
    def _calculate_risk_score(self, listed_blocklists: List[str]) -> int:
        """Calculate risk score based on blocklist matches"""
        # No listings = no risk
        if not listed_blocklists:
            return 0
            
        # Start with a base score of 25 for any blocklist match
        base_score = 25
        
        # Add 10 points for each additional blocklist beyond the first
        if len(listed_blocklists) > 1:
            base_score += min(25, (len(listed_blocklists) - 1) * 10)
        
        # Premium blocklists have higher weight
        premium_weight = 0
        for bl in listed_blocklists:
            if 'spamhaus' in bl:
                premium_weight += 10  # Spamhaus has higher reliability
            elif 'barracuda' in bl:
                premium_weight += 8   # Barracuda is also quite reliable
                
        # Cap the total score at 60
        return min(60, base_score + premium_weight)
