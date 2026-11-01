# UX specification

Written in words so an agent can build a prototype in one pass and a tester can follow it.

## Screens
For each screen: name, purpose, what the person sees first, primary action, secondary actions.

### [Screen name]
- Purpose:
- First thing seen:
- Primary action:
- Empty state:
- Loading state:
- Error state (what went wrong, what to do):
- Copy (exact words on buttons and headings):

### Scheduling calendar (/app/)
- Purpose: dentist and assistant see and manage the same appointment calendar.
- Primary actions: drag a request from **Requested Appointments** onto the calendar; click an appointment to see, edit or move it; drag or resize an appointment to move it; select an empty time range to book it.
- Safety: booking over another appointment or in the past asks "Double-check this time"; times outside 08:00–20:00 are refused with "The clinic is open 08:00–20:00."; deleting asks first. Move, edit, delete and new bookings can be undone from the toast.
- Keyboard: ← / → previous / next, T today, D / W / M day / week / month, N new appointment, Delete deletes the selected appointment.
- Error state: "… failed. Please try again."; when offline "You seem to be offline. … did not go through." with **Retry**; when a colleague changed it first "… someone else changed this in the meantime. Showing the latest version."

## Flows
Main flow from entry to the outcome the product promises. Number the steps and name the screen at each step.

## Prototype
Link: [...]
Tool used: [...]

## Hallway tests
Two participants, three tasks, think-aloud, 15 minutes each. Record: what they tried first, where they hesitated, what they said, whether they finished.

### Participant A (role, no name)
### Participant B (role, no name)

## Changes made after testing
