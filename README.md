# Prestine Mobile Detailing — Booking Website

A customer-facing booking site and admin dashboard for a mobile car detailing business. Customers book online, pay in person after the job.

## Quick Start (local dev)

1. **Serve the files** with any static server. For example:
   ```
   cd "Prestine Mobile Detailing"
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

2. **Customer flow**: click **Book Now**, pick a service, date, time, fill in contact info, and submit.

3. **Admin panel**: go to `/admin.html` (or click the Admin link in the footer). Log in with the dev password set in `js/config.js` (default: `admin123`).

## Firebase Setup (optional — for real data persistence)

Without Firebase, all data lives in your browser's `localStorage`. That's fine for testing, but it means data is per-browser and not shared. To use a real database:

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (start in test mode)
3. Enable **Authentication** → Email/Password sign-in method
4. Create an admin user in the Authentication tab
5. Copy your web app config into `js/config.js` (replace the `YOUR_*` placeholders)
6. Add the Firebase SDK scripts to each HTML file's `<head>`:
   ```html
   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
   ```

## Project Structure

```
index.html        Landing page — services, about, contact
booking.html      Multi-step booking flow
login.html        Admin login
admin.html        Admin dashboard (bookings, calendar, services, customers, availability)
css/style.css     All styles (mobile-first, dark theme)
js/config.js      Firebase config + business info + dev password
js/firebase-init.js  Firebase SDK init (no-op if not configured)
js/db.js          Data layer — Firestore with localStorage fallback
js/utils.js       Date/time helpers, slot generation
js/auth.js        Login/logout, admin guard
js/booking.js     Customer booking flow logic
js/admin.js       Admin dashboard logic
```

## Admin Features

- **Bookings**: view/filter/edit bookings, change status, create manual bookings
- **Calendar**: weekly grid view of all appointments
- **Services**: create/edit/delete service packages (name, price, duration, active toggle)
- **Customers**: view customer list, edit details, see booking history
- **Availability**: set working hours per weekday, block specific dates, configure slot spacing
