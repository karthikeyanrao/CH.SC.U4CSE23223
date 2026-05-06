import urllib.request
import json
import heapq
from datetime import datetime, timezone

LOG_API_URL = "http://20.207.122.201/evaluation-service/logs"
NOTIFICATIONS_API_URL = "http://20.207.122.201/evaluation-service/notifications"
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJyaXBwbGVza2FydGhpQGdtYWlsLmNvbSIsImV4cCI6MTc3ODA2MjI2MiwiaWF0IjoxNzc4MDYxMzYyLCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiYTdkZmUzNDItM2E0YS00M2NjLWE5ODItYjk3ZWJhMGYwZGJkIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoia2FydGhpa2V5YW4gcyIsInN1YiI6ImU0YjE4NzQ4LWFjYzktNDBlYy05NzIyLTAyZTZhODJmZTlhNiJ9LCJlbWFpbCI6InJpcHBsZXNrYXJ0aGlAZ21haWwuY29tIiwibmFtZSI6ImthcnRoaWtleWFuIHMiLCJyb2xsTm8iOiJjaC5zYy51NGNzZTIzMjIzIiwiYWNjZXNzQ29kZSI6IlBUQk1tUSIsImNsaWVudElEIjoiZTRiMTg3NDgtYWNjOS00MGVjLTk3MjItMDJlNmE4MmZlOWE2IiwiY2xpZW50U2VjcmV0IjoiVUVGU3VwalRaVGh4elNWdyJ9.Agw4mXMJKqEkEfLO5nuVYJTVeRywgf3E31UB6twweeI"

def Log(stack, level, package_name, message):
    """Mandatory Logging Integration using strict constraints."""
    stack = stack.lower()
    level = level.lower()
    package_name = package_name.lower()
    
    payload = {
        "stack": stack,
        "level": level,
        "packageName": package_name,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    
    try:
        req = urllib.request.Request(LOG_API_URL, data=json.dumps(payload).encode('utf-8'), headers={
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN
        })
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass 
    print(f"[{payload['timestamp']}] [{level}] [{package_name}]: {message}")

WEIGHTS = {
    "placement": 3,
    "result": 2,
    "event": 1
}

def get_priority_score(notif):
    n_type = notif.get("Type", "").lower()
    weight = WEIGHTS.get(n_type, 0)
    timestamp_str = notif.get("Timestamp", "")
    try:
        dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
        recency = dt.timestamp()
    except Exception:
        recency = 0
         
    return (weight, recency)

def fetch_notifications():
    Log("backend", "info", "priority_inbox", f"Fetching notifications from {NOTIFICATIONS_API_URL}")
    try:
        req = urllib.request.Request(NOTIFICATIONS_API_URL, headers={"Authorization": AUTH_TOKEN})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            return data.get("notifications", [])
    except Exception as e:
        Log("backend", "error", "priority_inbox", f"Failed to fetch notifications: {str(e)}")
        return []

def main():
    Log("backend", "info", "priority_inbox", "Starting Priority Inbox processing")
    
    notifications = fetch_notifications()
    Log("backend", "info", "priority_inbox", f"Fetched {len(notifications)} notifications.")
    top_n = 10
    heap = []
    
    for i, notif in enumerate(notifications):
        score = get_priority_score(notif)
        
       
        heap_item = (score, i, notif)
        
        if len(heap) < top_n:
            heapq.heappush(heap, heap_item)
        else:
            heapq.heappushpop(heap, heap_item)
            
    
    top_notifications = sorted(heap, key=lambda x: x[0], reverse=True)
    
    Log("backend", "info", "priority_inbox", f"Successfully computed top {len(top_notifications)} notifications.")
    
    print("\n--- Priority Inbox (Top 10) ---")
    for rank, (score, _, notif) in enumerate(top_notifications, 1):
        print(f"{rank}. [{notif.get('Type')}] {notif.get('Message')} (Time: {notif.get('Timestamp')})")

if __name__ == "__main__":
    main()
