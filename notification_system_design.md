# Notification System Design

## Stage 1: REST API Design & Real-time Mechanism

### Core Actions
1. **Fetch Notifications**: Retrieve a list of notifications (Placements, Events, Results) for the logged-in user.
2. **Mark as Read**: Update the status of a notification to 'read' once the user has seen it.
3. **Unread Count**: Fetch the total number of unread notifications for the notification badge.

### REST API Endpoints

#### 1. GET /api/v1/notifications
Retrieves all notifications for the authenticated student.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "notificationType": "Placement",
      "title": "New Job Opportunity: Google",
      "message": "Software Engineer (New Grad) roles are now open.",
      "isRead": false,
      "createdAt": "2026-05-06T14:00:00Z"
    }
  ],
  "meta": {
    "unreadCount": 12
  }
}
```

#### 2. PATCH /api/v1/notifications/{id}/read
Marks a specific notification as read.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Notification marked as read",
  "updatedAt": "2026-05-06T14:15:00Z"
}
```

#### 3. GET /api/v1/notifications/summary
Returns a summary count of unread notifications categorized by type.
- **Response (200 OK)**:
```json
{
  "success": true,
  "summary": {
    "Placement": 5,
    "Result": 2,
    "Event": 5,
    "Total": 12
  }
}
```

### Real-time Notification Mechanism
To ensure students receive updates instantly without refreshing, we will implement **WebSockets** using **Socket.io**.
- **Strategy**: When a new notification is generated in the backend (e.g., HR clicks "Notify All"), the server will emit a `new_notification` event to the specific student's socket room.
- **Client Handling**: The frontend listens for this event and updates the local state/UI immediately, providing a seamless "real-time" experience.

