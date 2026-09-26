# Requirements

## Functional requirements
User authentication (2FA)
Booking confirmation 
Notification system
User roles and permissions
Integration with third party services
Calendar system
Appointment Request Management
User Info search for admins


## Non-functional requirements
- Performance: first screen usable within 2 s on a 4G phone
- Accessibility: keyboard navigation works, axe reports no serious issues
- Security: row level security on every Supabase table; the anon key exposes nothing private
- Privacy: no real personal data in the database or the repository; usability testers give consent
- Availability: the dev URL is up during class hours; a failed deploy is rolled back the same day
- The system must be accessible on Chrome, Safari, Firefox.
-The Whatsapp bot must reply within 6 seconds given a request.
-User info must be encrypted before storage
-Making changes to any appointment must look seamless in the GUI
-The system must be flexible so that updates and patches don’t disrupt uptime


## User stories
Write at least eight. Each one has acceptance criteria the agent can turn into a Playwright test.

// User Story: As a practitioner, I want to be able to view my schedule on my phone, so that I can check my appointments when I am out of the office.
Given I am logged into the mobile application as a practitioner,
When I navigate to the daily calendar view,
Then I should see a clear chronological list of all my appointments for that day, even when I am away from the physical clinic.
// User Story: As a clinic secretary, I want to view and edit the practitioner's digital calendar, so that we are both looking at the same real-time schedule.
Given a client calls to modify an appointment during office hours,
When I change the appointment slot on my desktop computer dashboard,
Then the updated time must immediately sync and reflect on the practitioner's mobile view without requiring a page refresh.
// User Story: As a practitioner, I want to click a button next to an appointment to message the client directly on WhatsApp, so that I don't have to manually save their phone number to my personal contacts.
Given I am looking at a specific client's appointment details on my phone,
When I tap the "Message via WhatsApp" action button,
Then the device should automatically open the WhatsApp application into a direct chat window with that client's pre-filled phone number.
// User Story: As a secretary, I want to mark an appointment status as "Confirmed", so that the practitioner knows the client is locked in and work doesn't have to stop for verbal verification.
Given I have just spoken with a client who confirmed their attendance,
When I click the "Confirm" button on their calendar entry,
Then the appointment color block should turn green on both my dashboard and the practitioner’s mobile screen.
// User Story: As a practitioner, I want my calendar to remain completely private from the public, so that clients cannot see my open slots or book themselves without manual acceptance.
Given an unauthenticated external user attempts to access the calendar web link,
When they load the page,
Then they should be met with a secure login wall, ensuring no scheduling blocks or open hours are visible to the public.
// User Story: As a secretary, I want to drag and drop appointments to dynamically squeeze in an urgent client, so that we can easily adjust to fluctuating client priorities.
Given a long-term client calls with an urgent dental/medical emergency,
When I drag their name into a narrow gap or overlap a slot on the calendar view,
Then the system should save the modification and highlight the appointment as "Urgent / Fit-In" to alert the practitioner.
// User Story: As a practitioner, I want historical client appointment logs to be securely archived indefinitely, so that I never lose data when a physical paper notebook gets thrown away at the end of the year.
Given I need to look up a past client who only visited once or twice two years ago,
When I search their name in the universal archive search bar,
Then the system should display their entire chronological appointment history without any data degradation over time.
// User Story: As a practitioner, I want to see basic client contact details directly attached to the calendar appointment, so that I can safely handle customer emergencies when I am physically away from the office file cabinets.
Given I am answering an emergency client call on WhatsApp while at home,
When I open their specific calendar slot on my phone,
Then it must display a read-only view of their primary phone number, full name, and brief notes from their last visit.


### S1 · [Title]
As a [persona], I want [action], so that [benefit].

Acceptance criteria
- Given [starting state], when [action], then [observable result]
- Given ..., when ..., then ...

Status: todo · PR: [link]

### S2 · ...

## Events (from event storming)
Past-tense events in order, with the command that triggers each and the external systems involved.
