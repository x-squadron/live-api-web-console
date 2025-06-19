export const TASK_TOOL_REGISTRY: Record<string, string> = {
  // ✅ Task & Project Management
  // asana: "ASANA_GET_A_USER_TASK_LIST",
  // clickup: "",
  // jira: "",
  /* 
  🧩  Linear
  🔑 key: first ➡ first: Cursor for pagination. Use the `endCursor` from the previous response's `page_info` to fetch the next set of issues.
  */
  linear: "LINEAR_LIST_LINEAR_ISSUES",
  // monday: "",
  // notion: "",
  // todoist: "",
  // wrike: "",
  // github: "",
  // gitlab: "",
  // productboard: "",

  // 📅 Calendar & Events
  /*
  🧩  Google Calendar
  🔑 key: timeMin ➡ Time Min: Lower bound (exclusive) for an event's end time to filter by. Only events ending after this time are included. Accepts multiple formats: 1. RFC3339 timestamp (e.g., '2024-12-06T13:00:00Z') 2. Comma-separated date/time parts (e.g., '2024,12,06,13,00,00') 3. Simple datetime string (e.g., '2024-12-06 13:00:00')
  🔑 key: timeMax ➡ Time Max: Upper bound (exclusive) for an event's start time to filter by. Only events starting before this time are included. Accepts multiple formats: 1. RFC3339 timestamp (e.g., '2024-12-06T13:00:00Z') 2. Comma-separated date/time parts (e.g., '2024,12,06,13,00,00') 3. Simple datetime string (e.g., '2024-12-06 13:00:00')
  */
  googlecalendar: "GOOGLECALENDAR_FIND_EVENT",
  // outlook: "",
  // calendly: "",
  // microsoft_teams: "",
  // zoom: "",
  // webex: "",
  // eventbrite: "",

  // 🎫 Ticketing / Support
  // zendesk: "",
  // intercom: "",
  // hubspot: "",
  // gorgias: "",
  // freshdesk: "",
  // salesforce: "",
  // service_now: "",
};
