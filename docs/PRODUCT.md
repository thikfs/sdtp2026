# Product statement

## Client
The client is a dentist and his assistant. They work in a small private dental clinic. We contacted them by messaging their phone number.

## The process today
 1. A client calls the clinic to make an appointment, change or cancel their appointment. As of now, this only works during work hours, and the communication is slow and takes time. Day to day the clinic also talks to clients on WhatsApp and by phone.
 2. The assistant checks the notebook by hand to find a free slot. Clients who want to be fitted in are judged by how urgent their situation is, and when they are available.
 3. The appointment, the client's details and notes from the visit are written in the notebook.
 4. To confirm a client, the dentist and assistant sometimes have to stop all work and confirm it by phone.
 5. When the dentist is out of the office he cannot see his schedule or any client information, because the notebooks stay at the clinic. He cannot tend to clients and has to call them through WhatsApp.
 6. To look up a client's history, someone has to go through the notebooks. A notebook is gone through about once a year. After some time the notebooks are thrown away, so client data is lost.

Where it hurts the clinic: looking up client history is slow, appointments are checked manually, the dentist is cut off from his schedule outside the office, work stops for confirmations, and history disappears when notebooks are thrown away.

What it costs: about 5 euros a year in notebooks. The interview did not answer how much space the notebooks take up, or how often something goes wrong (for example a double booking or a lost record).

## Baseline metric
One number that describes the process today: minutes per task, errors per week, euros per month. Source of the number.
about 4 minutes to confirm an appointment.

## The statement
When a dental clinic assistant is confirming or rescheduling a client’s appointment but the schedule is on a notebook that the dentist can’t see outside the office, so work stops for verbal confirmation, our shared calendar lets them confirm or move a slot in one action and shows it instantly on the dentist’s phone with a WhatsApp button to the client, so that appointment confirmations go from 4 minutes today to less than 1.

## Out of scope
Three things we will not build, so the agent does not build them either.
1. payment method
2. automated appointment acceptance
3. medical supply and equipment tracking

## Red-team notes
The five hardest questions a sceptical CTO asked, and our answers. See the prompt in the session 2 brief.
The five hardest questions a sceptical CTO could ask, with answers from our own documents. TODO: compare with the output of the session 2 prompt and replace anything that differs.

1. **Why not just use a shared Google Calendar?** A shared calendar covers seeing the schedule on a phone. The client also asked for a confirmation status that both people see, a WhatsApp button on each appointment, a searchable client history with notes, and a calendar that stays private behind a login.
2. **This is health-related client data. How is it protected?** We build with fictional data only. Row level security is planned on every table, user info is encrypted before storage, and the calendar is behind a login with 2FA. We have not done a data protection review for real data. That must happen before any real client record goes in.
3. **What if the WhatsApp integration is unreliable or costs money?** The WhatsApp button in the stories opens a chat with the client's number and needs no bot. The WhatsApp Cloud API bot is a separate requirement.
4. **Will two non-technical people actually switch from notebooks?** We will test with the dentist and his assistant in session 9, using tasks taken from their real calls. Importing old notebooks is not in the current scope. 
5. **How do you know it saves 3 minutes?** We don't yet. 4 minutes is an estimate from our call with our client. We will time real confirmations before and after, and record the result in docs/VALIDATION.md.

