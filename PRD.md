**PRODUCT REQUIREMENTS DOCUMENT**

**PlayField**

Outdoor Activity Booking & Venue Management Platform

Version 4.0  |  March 2026  |  50 Sport Categories

Confidential — team Atoaxis

| Field | Details |
| :---- | :---- |
| Author | Arm (team Atoaxis) |
| Status | Draft v4 |
| Target Launch | Q4 2026 |
| Sport Categories | 50 types across 7 groups |
| Stakeholders | Product, Operations, Venue Partners, Finance |

# **1\. Executive Summary**

PlayField is an all-in-one platform that lets outdoor activity venues manage bookings, on-site operations (check-in, POS, equipment rental), self-service F\&B kiosks with kitchen order management, and coach booking from a single system. Customers get a frictionless experience from discovery to checkout.

The platform serves three user groups through dedicated interfaces: customers (mobile app), venue operators (management dashboard), and AtoAxis administrators (platform oversight portal).

# **2\. Problem Statement**

* Court/field availability is tracked via LINE groups or whiteboards — constant double-bookings and lost revenue.

* Equipment rental has no tracking. Items go missing, and deposits are handled in cash with no audit trail.

* F\&B runs on a separate POS disconnected from the venue flow. No group billing capability.

* Coach scheduling is done via personal chat with no centralized calendar or payment integration.

* Customers must call or message multiple channels to book, pay, and confirm — high friction, high drop-off.

* Venue owners have zero analytics: no occupancy data, no revenue breakdown, no reconciliation tools.

# **3\. User Personas**

## **3.1 Customer (Player / Visitor)**

**Who:** Anyone booking outdoor activities — casual players, regular teams, families, tourists.

**Goal:** Find a venue, book a court/field, show up, play, eat, pay, leave — all without friction.

**Pain:** Currently must LINE the venue, wait for a reply, transfer money manually, screenshot the slip, and hope the slot isn’t double-booked.

## **3.2 Venue Operator (Space Owner)**

**Who:** Sports complex owners, adventure park managers, fitness center operators, and their staff.

**Goal:** Maximize occupancy, minimize no-shows, track equipment, serve food efficiently, and manage coaches.

**Pain:** Juggling LINE, spreadsheets, a separate POS, paper equipment logs, and manual cash reconciliation.

## **3.3 AtoAxis Admin**

**Who:** team Atoaxis managing the multi-venue marketplace.

**Goal:** Onboard venues, ensure quality, track platform revenue, resolve disputes, maintain health.

**Pain:** No centralized view of venue performance, manual payout calculations, no moderation tooling.

# 

# **4\. Supported Sport Categories & Equipment (50 Types)**

PlayField supports 50 sport/activity categories organized into 7 groups by resource type. Each category defines the bookable resource, typical session duration, and rentable equipment available at the venue.

## **4.1 Court-Based Sports (12)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Tennis | Tennis Court | 60 min | Racket, balls, shoes, wristband, overgrip |
| 2 | Badminton | Badminton Court | 60 min | Racket, shuttlecocks, shoes, grip tape |
| 3 | Basketball | Basketball Court | 60 min | Basketball, shoes, arm sleeve, headband |
| 4 | Volleyball | Volleyball Court | 60 min | Volleyball, knee pads, ankle brace |
| 5 | Futsal | Futsal Court | 60 min | Futsal ball, shoes, shin guards, bibs |
| 6 | Squash | Squash Court | 45 min | Racket, ball, goggles, wristband |
| 7 | Pickleball | Pickleball Court | 60 min | Paddle, balls, shoes, visor |
| 8 | Table Tennis | Table Tennis Table | 30 min | Paddle, balls, net (replacement) |
| 9 | Handball | Handball Court | 60 min | Handball, shoes, gloves (goalkeeper) |
| 10 | Padel | Padel Court | 60 min | Padel racket, balls, shoes, overgrip |
| 11 | Sepak Takraw | Takraw Court | 60 min | Rattan ball, shoes, ankle support |
| 12 | Racquetball | Racquetball Court | 45 min | Racquet, ball, goggles, glove |

## 

## 

## **4.2 Field & Pitch Sports (8)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 13 | Football (Soccer) | Football Pitch | 90 min | Football, shoes, shin guards, bibs, and goalkeeper gloves |
| 14 | Cricket | Cricket Pitch | 120 min | Bat, ball, pads, helmet, gloves, stumps |
| 15 | Rugby | Rugby Field | 80 min | Rugby ball, scrum cap, mouthguard, shoulder pads |
| 16 | Baseball / Softball | Baseball Diamond | 120 min | Bat, ball, glove, helmet, catcher's gear |
| 17 | Field Hockey | Hockey Pitch | 70 min | Hockey stick, ball, shin guards, mouthguard |
| 18 | Lacrosse | Lacrosse Field | 60 min | Stick, ball, helmet, gloves, arm pads |
| 19 | Flag Football | Flag Football Pitch | 60 min | Football, flag belts, cones, bibs |
| 20 | Ultimate Frisbee | Open Field | 60 min | Discs, cones, bibs, and cleats |

## **4.3 Range & Lane Sports (6)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 21 | Bowling | Bowling Lane | 60 min | Bowling ball, bowling shoes |
| 22 | Archery | Archery Lane | 60 min | Bow (recurve/compound), arrows, arm guard, finger tab, target face |
| 23 | Shooting Range (Firearm) | Shooting Lane | 60 min | Firearm (rental), ammo, ear protection, eye protection, target |
| 24 | BB Gun / Pellet Range | BB Gun Lane | 45 min | BB gun/air rifle, pellets, safety glasses, target sheets |
| 25 | Golf (Tee Time) | Tee Time Slot | 240 min | Club set, golf cart, balls, tees, glove, rangefinder |
| 26 | Driving Range | Driving Bay | 60 min | Club (driver/iron), balls (bucket), glove, tees, mat |

## 

## 

## 

## 

## **4.4 Adventure & Extreme Sports (8)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 27 | Rock Climbing (Indoor) | Climbing Wall Slot | 120 min | Climbing shoes, harness, chalk bag, belay device, helmet |
| 28 | Paintball | Paintball Field Session | 90 min | Marker (gun), hopper, tank, mask, body armor, paintballs |
| 29 | Airsoft | Airsoft Field Session | 120 min | Airsoft gun, BBs, full-face mask, vest, gloves |
| 30 | Go-Kart | Go-Kart Track Slot | 15 min | Kart, helmet, racing suit, gloves, neck brace |
| 31 | Skateboarding | Skate Park Session | 120 min | Skateboard, helmet, knee pads, elbow pads, wrist guards |
| 32 | BMX | BMX Track Session | 120 min | BMX bike, helmet, knee pads, elbow pads, gloves |
| 33 | Trampoline Park | Trampoline Session | 60 min | Grip socks (mandatory), foam pit access |
| 34 | Bungee Jumping | Jump Slot | 30 min | Harness, ankle wrap, helmet (all provided) |

## **4.5 Water Sports (6)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 35 | Swimming | Pool Lane | 60 min | Goggles, swim cap, kickboard, pull buoy, fins |
| 36 | Scuba Diving | Dive Session | 180 min | Full dive gear: BCD, regulator, wetsuit, mask, fins, tank |
| 37 | Surfing | Board Rental Slot | 120 min | Surfboard, leash, wetsuit, rash guard, wax |
| 38 | Kayaking / Canoeing | Boat Rental Slot | 120 min | Kayak/canoe, paddle, life vest, dry bag, whistle |
| 39 | Wakeboarding | Cable Park Session | 60 min | Wakeboard, life vest, helmet, wetsuit, handle |
| 40 | Stand-up Paddleboard | SUP Rental Slot | 90 min | Paddleboard, paddle, life vest, leash, dry bag |

## 

## 

## **4.6 Fitness & Wellness (5)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 41 | Boxing / Muay Thai | Training Slot | 60 min | Gloves, hand wraps, shin guards, mouthguard, heavy bag |
| 42 | Yoga / Pilates | Class Slot | 60 min | Mat, blocks, strap, bolster, blanket |
| 43 | CrossFit | Box Session | 60 min | Jump rope, wrist wraps, knee sleeves, chalk |
| 44 | Dance Studio | Studio Session | 60 min | Dance shoes, resistance bands, water bottle |
| 45 | Ice Skating | Rink Session | 90 min | Ice skates, helmet, knee pads, elbow pads, gloves |

## **4.7 Outdoor & Rental-Primary (5)**

| \# | Sport / Activity | Resource | Duration | Rentable Equipment |
| :---- | :---- | :---- | :---- | :---- |
| 46 | Cycling | Bike Rental Slot | 240 min | Bicycle, helmet, lock, repair kit, bottle cage, gloves |
| 47 | ATV / Off-road | ATV Trail Slot | 60 min | ATV, helmet, goggles, gloves, boots |
| 48 | Horseback Riding | Riding Session | 60 min | Horse, helmet, boots (if not owned), crop |
| 49 | Zip Line / Canopy Walk | Zipline Session | 45 min | Harness, helmet, gloves, trolley (all provided) |
| 50 | Camping / Glamping | Campsite Slot | Overnight | Tent, sleeping bag, mat, lantern, cooking set, chair |

# 

# **5\. User Stories**

## **5.1 Customer Stories**

### **Booking**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-01 | As a customer, I want to search venues by sport type and location so I can find somewhere nearby to play. | Search returns venues sorted by distance. Filter by sport (50 categories), price range, and availability date. Results show ratings and photos. |
| C-02 | As a customer, I want to see real-time court/resource availability, so I know exactly which slots are open. | Availability grid updates live. Booked slots are grayed out. Selecting a slot locks it for 5 minutes during checkout. |
| C-03 | As a customer, I want to book a court, rent equipment, and book a coach in one transaction. | Single checkout flow combines all items. Total shows breakdown. One payment covers everything. |
| C-04 | As a customer, I want to set up recurring weekly bookings for my team. | Recurring booking: select day \+ time \+ repeat count. System checks conflicts for all dates upfront. One payment or pay-per-session option. |
| C-05 | As a customer, I want to join a waitlist when my preferred slot is taken. | The waitlist button appears on full slots. Auto-notification (push \+ LINE) when the slot opens. Position in the queue is visible. |

### **Check-in & On-site**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-06 | As a customer, I want to check in by showing a QR code so I don’t need to wait at a counter. | QR code available in app after booking confirmation. Self-scan at kiosk or staff scans. Check-in confirmed with sound \+ visual. |
| C-07 | As a customer, I want to walk in without a booking and start playing quickly. | Walk-in flow: staff selects sport → assigns available resource → instant booking created → QR issued. |
| C-08 | As a customer, I want my whole group to check in with one scan. | Group booking QR checks in all linked members. Dashboard shows who has arrived. Individual late arrivals can scan separately. |

### **Equipment Rental**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-09 | As a customer, I want to rent equipment when I book so it’s ready when I arrive. | Equipment selection appears in booking flow with photos, condition grade (A/B/C), and deposit amount. Reserved items held for the booking time. |
| C-10 | As a customer, I want my deposit auto-refunded when I return equipment undamaged. | Return confirmed by staff → condition check → if no damage, deposit refund processed automatically within the same session. |
| C-11 | As a customer, I want to see what equipment is included vs. what costs extra for each sport. | Booking page shows: included items (e.g., grip socks for trampoline) vs. optional rentals with prices. |

### **Food & Beverage**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-12 | As a customer, I want to order food from a kiosk and have it charged to my group’s tab. | Scan group QR at kiosk → browse menu → add items → order placed. Charges appear on group bill. No separate payment needed. |
| C-13 | As a customer, I want to track my food order status in real-time. | Order status updates: Received → Preparing → Ready. Push notification when ready. Pickup number displayed on screen and in app. |
| C-14 | As a customer, I want to customize my order (add-ons, spice level, special instructions). | Each menu item can have configurable options. Special instructions free-text field. Kitchen sees all customizations on the ticket. |

### **Coach Booking**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-15 | As a customer, I want to browse coaches by sport and see their ratings and availability. | Coach listing filterable by sport. Profile shows: bio, certifications, rating (min 3 sessions before visible), hourly rate, available time slots. |
| C-16 | As a customer, I want booking a coach to automatically reserve a court/resource for the session. | Selecting a coach \+ time → system finds available resource → both reserved together. If no resource available, customer sees next available option. |
| C-17 | As a customer, I want to cancel a coach session with a clear cancellation policy. | Free cancel if 24h+ before session. 50% charge if 12–24h. Full charge if \< 12h. Policy shown before booking confirmation. |

### 

### 

### 

### 

### 

### 

### 

### **Payment & Billing**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| C-18 | As a customer, I want to pay with Thai QR (PromptPay) by scanning with my banking app. | Select ‘Thai QR’ → QR displayed on screen → scan with any Thai bank app → payment confirmed within seconds → booking confirmed. |
| C-19 | As a customer, I want to open a group tab so all my friends’ charges go to one bill. | Create group → invite members via link/QR → any member’s bookings, rentals, food charges added to group tab. Split evenly or by item at checkout. |
| C-20 | As a customer, I want one consolidated bill at the end covering court, food, rental, and coach fees. | Checkout shows full breakdown: booking, equipment deposit, F\&B orders, coach session. Single payment settles all. Digital receipt sent. |

## **5.2 Space Owner Stories**

### 

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| S-01 | As a venue operator, I want to see today’s bookings and real-time arrivals on one dashboard. | Dashboard shows: today’s booking timeline per resource, arrival feed (live), occupancy rate, revenue so far, upcoming slots. |
| S-02 | As a venue operator, I want to process walk-in customers in under 30 seconds. | Walk-in flow: select sport → see available resources → tap to assign → booking created \+ QR issued. Target: \< 30 sec. |
| S-03 | As a venue operator, I want no-shows to auto-release their slot after a grace period. | Configurable grace period (default 15 min). After grace, slot status \= ‘released’ and becomes bookable. Customer notified. |
| S-04 | As a venue operator, I want to set buffer time between bookings for cleaning/setup. | Per-resource setting: buffer minutes (default 15). Buffer blocks visible on calendar but not bookable. |
| S-05 | As a venue operator, I want to configure which sport categories and equipment my venue supports. | Venue settings: toggle sport categories on/off from the 50 supported types. Configure available equipment per sport. |

### 

### 

### 

### 

### 

### 

### **Booking & Check-in**

### **POS & Payment**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| S-06 | As a venue operator, I want to accept Thai QR, card (EDC), and cash from one POS screen. | POS shows 3 payment buttons: Thai QR (generates QR), Card (sends to EDC terminal), Cash (enter amount, calculate change). |
| S-07 | As a venue operator, I want end-of-day reconciliation showing cash vs. digital vs. expected. | Auto-generated report: total by payment method, expected cash on hand, actual (staff enters), variance highlighted. Exportable. |
| S-08 | As a venue operator, I want to process refunds with manager approval. | Staff initiates refund → manager receives approval request → approved → refund to original payment method. Partial refunds supported. |

### **Equipment**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| S-09 | As a venue operator, I want to track every equipment item from issue to return. | Each rental: issue → in-use → returned → inspected → available. Full audit trail per item. |
| S-10 | As a venue operator, I want to flag damaged equipment and auto-deduct from deposit. | On return: staff marks condition. If damaged, takes photo \+ notes. System deducts repair cost from deposit. |
| S-11 | As a venue operator, I want equipment auto-removed from rental pool after N uses for maintenance. | Configurable threshold per equipment type. Auto-flag for maintenance. Staff confirms service done to return to pool. |
| S-12 | As a venue operator, I want to manage safety-mandatory equipment (e.g., grip socks for trampoline, helmets for paintball). | Per-sport config: mark equipment as ‘mandatory’. System enforces: booking cannot proceed without mandatory item confirmed (included or rented). |

### **F\&B / Kitchen**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| S-13 | As kitchen staff, I want orders to appear on screen automatically with all details. | KDS shows order tickets: items, quantities, customizations, pickup number, time elapsed. New orders appear instantly. |
| S-14 | As kitchen staff, I want to mark items done and have the system notify the customer. | Tap item → done. All items done → order \= ‘Ready’ → push notification \+ pickup number on screen. |
| S-15 | As kitchen staff, I want orders routed to the correct prep station automatically. | Each menu item tagged with station. KDS filters by station. Each screen shows only their items. |
| S-16 | As kitchen staff, I want a timer alert when orders are taking too long. | Yellow at 8 min, red at 12 min. Manager notified for red alerts. |
| S-17 | As a venue operator, I want to manage my F\&B menu (items, prices, photos, availability). | Menu editor: add/edit items with photo, price, category, station tag, dietary tags. Toggle on/off. |

### 

### 

### **Coach & Pricing**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| S-18 | As a venue operator, I want to onboard coaches with profiles and set revenue splits. | Add coach: name, bio, certifications, sports, hourly rate, photo. Revenue split configurable (default 70/30). |
| S-19 | As a venue operator, I want to set peak/off-peak pricing per resource. | Pricing rules: weekday/weekend, time-of-day tiers, member discount %. Calendar preview shows the effective price. |
| S-20 | As a venue operator, I want revenue reports broken down by source. | Report: revenue by category (booking, rental, F\&B, coach), by payment method, by day/week/month. Exportable. |
| S-21 | As a venue operator, I want occupancy heatmaps to optimize scheduling. | Heatmap: X \= hour, Y \= day of week. Color \= occupancy %. Per resource or aggregated. 30/90 day range. |

## **5.3 AtoAxis Admin Stories**

| ID | User Story | Acceptance Criteria |
| :---- | :---- | :---- |
| A-01 | As an AtoAxis admin, I want to review and approve new venue applications. | Queue of pending venues: business docs, photos, location, Stripe setup status. Approve/reject with notes. |
| A-02 | As an AtoAxis admin, I want platform-wide analytics: GMV, bookings, and venue rankings. | Dashboard: total GMV, booking count, active venues, active users, growth trend. Venue leaderboard. |
| A-03 | As an AtoAxis admin, I want to track commissions and manage payout schedules. | Commission per transaction visible. Payout schedule configurable. Payout history with transfer IDs. |
| A-04 | As an AtoAxis admin, I want to moderate flagged reviews and content. | Moderation queue: flagged reviews, reported photos. Preview \+ context. Approve, remove, or warn. |
| A-05 | As an AtoAxis admin, I want to verify coach certifications before they go live. | Verification queue: uploaded certs, ID. Admin marks verified/rejected. Only verified coaches visible. |
| A-06 | As an AtoAxis admin, I want to override refunds and resolve disputes. | Support console: search by booking ID, customer, venue. Issue a manual refund. Full audit trail. |
| A-07 | As an AtoAxis admin, I want to manage the master list of sport categories and their equipment. | Sport category editor: add/remove/edit the 50 categories. Define mandatory vs optional equipment per sport. |

# 

# **6\. Business Rules**

## **6.1 Booking Rules**

* A slot can only be held by one booking at a time. Overlapping bookings for the same resource are blocked.

* When a customer starts checkout, the selected slot is locked for 5 minutes. If payment is not completed, the lock expires, and the slot is released.

* Buffer time (default 15 min, configurable per resource) is enforced between consecutive bookings.

* Recurring bookings check availability for all selected dates upfront. If any date has a conflict, the customer is notified before confirming.

* Walk-in bookings are created instantly and bypass the lock timer since payment is immediate.

* No-show grace period: if not checked in within the grace period (default 15 min), status \= ‘no-show’ and slot may be released.

* Some activities (e.g., Go-Kart, Bungee) have fixed session times. Customers book a specific session, not a flexible time range.

* Overnight bookings (e.g., Camping/Glamping) use date-based slots instead of time-based slots.

## **6.2 Payment Rules**

* Thai QR (PromptPay): QR code expires after 15 minutes. If expired, the customer must regenerate.

* EDC Terminal: payment amount sent to the physical terminal. Staff cannot modify the amount on the terminal.

* Cash: the staff enters the amount received, system calculates the change. Transaction recorded for reconciliation.

* Group billing: any member can add charges. Split options: equal, by item, or one person pays all.

* Equipment deposit collected at issue time, held as liability. Refunded on return (minus damage deduction).

* Coach revenue split between venue and coach per the configured ratio. Payout via the platform to the coach’s bank.

* Platform commission is deducted from each transaction before venue payout.

* Refunds require manager approval. Partial refunds allowed. Refunded to the original payment method.

## **6.3 Equipment Rules**

* Equipment lifecycle: Available → Issued → In-use → Returned → Inspected → Available (or Maintenance).

* Condition grades: A (new/excellent), B (good/minor wear), C (usable/visible wear). Grade affects rental price.

* Damaged returns: staff photographs damage, records notes. Repair cost deducted from deposit.

* Auto-maintenance: equipment flagged after N rentals, removed from pool until staff confirms service.

* Overbooking prevention: real-time count of available items per type, blocks rental when count \= 0\.

* Mandatory equipment: some sports require specific items (e.g., a mask for paintball, grip socks for trampoline). The system enforces this at booking time.

* Safety waivers: adventure sports (paintball, airsoft, go-kart, bungee, zipline) require a digital waiver signature before check-in.

## **6.4 F\&B / Kitchen Rules**

* Orders from the kiosk are sent immediately to the Kitchen Display System (KDS).

* Each menu item is tagged with a prep station. Orders auto-split across stations.

* All items done → status \= ‘Ready’ → customer notified via push \+ screen.

* Timer: yellow warning at 8 min, red alert at 12 min. Manager notified on red.

* Out-of-stock items toggled off in the menu editor, reflected on the kiosk/app immediately.

* Idempotency key per order prevents duplicates from kiosk retries.

## **6.5 Coach Rules**

* Coaches must be verified (certification check) before appearing in the customer search.

* Coach sets own availability. System prevents double-booking across sessions.

* Booking a coach auto-reserves a matching resource for the session.

* Session types: Private (1), Semi-private (2–4), Group (5+). Different pricing tiers.

* Cancellation: free 24h+, 50% charge 12–24h, full charge \< 12h. Configurable per venue.

* Reviews visible only after 3+ completed sessions’ worth of ratings.

* Revenue split default: 70% venue / 30% coach. Overridable per coach.

## 

## **6.6 Pricing Rules**

* Each resource can have multiple pricing tiers: weekday, weekend, peak, and off-peak.

* Member discounts are applied as a percentage off the base price.

* Bundle pricing: venue creates packages (e.g., court \+ 2 rackets at 15% discount).

* Dynamic pricing changes take effect from the next available slot, never retroactively.

* Minimum booking duration: 1 slot (configurable, typically 30 or 60 min).

* Adventure activities (paintball, go-kart, etc.) may use per-session fixed pricing instead of hourly.

## **6.7 Safety & Compliance Rules**

* Adventure/extreme sports require a digital waiver signature before check-in. Waiver stored with booking record.

* Age restrictions: some activities (shooting range, bungee, go-kart) have a minimum age. The system enforces at booking if age is on the profile.

* Mandatory safety briefing: venues can configure a pre-session briefing requirement. Check-in blocked until briefing confirmed.

* Equipment safety checks: staff must confirm safety gear is properly fitted before the session starts (paintball mask, climbing harness, etc.).

* Incident reporting: staff can log incidents (injury, equipment failure) linked to a booking. Auto-notifies the venue owner and AtoAxis admin.
