# Monsoon Cup 2026: a full tournament played through the UI

Date of the run: 2026-10-20 (local Supabase stack, local FastAPI, Next.js dev server). Every step was done in the in-app browser the way a
user would do it. The one exception is time: matches are 12 + 1 + 12 minutes and the clock was moved forward in the database between
events (see "What was not real").

## Result

**Champions: Iron Wolves** (Final 2-1 over Red Falcons). Third place: Thunder Hawks (2-1 over Coastal Kings).

| # | Stage | Match | Score | Referee | Notes |
|---|---|---|---|---|---|
| 1 | Group A | Iron Wolves v Storm Riders | 3-0 | Imran | First full match, lineups, undo, offline queue |
| 2 | Group B | Coastal Kings v Thunder Hawks | 2-1 | Sunita | Substitution, red card |
| 3 | Group A | Golden Eagles v Red Falcons | 2-2 | Deepak | Yellow card |
| 4 | Group B | Blue Stallions v Night Owls | 1-2 | Sunita | |
| 5 | Group A | Iron Wolves v Red Falcons | 2-2 | Imran | |
| 6 | Group B | Coastal Kings v Night Owls | 2-0 | Sunita | |
| 7 | Group A | Storm Riders v Golden Eagles | 0-3 | Deepak | Storm Riders no-show, 3-0 awarded |
| 8 | Group B | Thunder Hawks v Blue Stallions | 3-0 | Sunita | |
| 9 | Group A | Iron Wolves v Golden Eagles | 1-0 | Imran | Foul logged |
| 10 | Group B | Coastal Kings v Blue Stallions | 0-1 | Sunita | Two yellows, automatic red |
| 11 | Group A | Red Falcons v Storm Riders | 3-1 | Deepak | |
| 12 | Group B | Night Owls v Thunder Hawks | 1-2 | Sunita | |
| 13 | Semi-final 1 | Iron Wolves v Coastal Kings | 2-1 | Imran | |
| 14 | Semi-final 2 | Thunder Hawks v Red Falcons | 1-1 (pens 4-5) | Sunita | Decided by the organizer on the penalty form |
| 15 | Third place | Coastal Kings v Thunder Hawks | 1-2 | Imran | A goal was undone and re-recorded |
| 16 | Final | Iron Wolves v Red Falcons | 2-1 | Deepak | Recorded by the scorer, Priya |

Group tables (computed by the app; they match the hand calculation):

| Group A | P | W | D | L | GF | GA | GD | Pts |
|---|---|---|---|---|---|---|---|---|
| Iron Wolves | 3 | 2 | 1 | 0 | 6 | 2 | +4 | 7 |
| Red Falcons | 3 | 1 | 2 | 0 | 7 | 5 | +2 | 5 |
| Golden Eagles | 3 | 1 | 1 | 1 | 5 | 3 | +2 | 4 |
| Storm Riders | 3 | 0 | 0 | 3 | 1 | 9 | -8 | 0 |

| Group B | P | W | D | L | GF | GA | GD | Pts |
|---|---|---|---|---|---|---|---|---|
| Thunder Hawks | 3 | 2 | 0 | 1 | 6 | 3 | +3 | 6 |
| Coastal Kings | 3 | 2 | 0 | 1 | 4 | 2 | +2 | 6 |
| Night Owls | 3 | 1 | 0 | 2 | 3 | 5 | -2 | 3 |
| Blue Stallions | 3 | 1 | 0 | 2 | 2 | 5 | -3 | 3 |

Top scorers over the tournament: Hrithik Anand (Iron Wolves) 4; Farhan Sheikh, Kiran Pawar, Gaurav Menon and Lakshay Arora 3 each.
Cards: Jeevan Fernandes (Coastal Kings) 2 yellows and 1 red, Farhan Sheikh (Thunder Hawks) 1 red, Eklavya Rana and Sachin Wagh 1 yellow each.

## What was done (all through the UI)

1. The organizer registered, created the tournament (12 + 1 + 12, 8 teams, two groups of four, semi-finals, third place and a final), created a
   venue with two pitches, generated slots and opened registration.
2. 24 accounts were registered: 8 captains, 3 referees, 1 recorder (scorer), 8 players and 3 fans (one shared, local-only test password).
3. Friend codes, requests (sent, accepted, rejected), direct messages, team invitations (accepted, declined, late accept after submit).
4. Teams were registered with guest players, submitted, approved by the organizer, rosters locked and seeds set.
5. Scheduling: random draw first, reset, then seeded draw. Referees were granted by friend code and assigned per match from the grid.
6. Lineups were submitted by captains and confirmed by the referee. Matches were kicked off, recorded, paused, taken to half time, second half,
   full time and completed.
7. Knockout slots filled themselves. One drawn semi-final was decided with a penalty score.
8. The organizer closed registration, launched the tournament and ended it. Stats pages were checked for every match and for the tournament.

## Things that went wrong and were found by doing it (fixed)

| # | Finding | Screenshots | Fix |
|---|---|---|---|
| 1 | The event settings page looped on HTTP 406 for the owner of a DRAFT event (the policy compared the wrong column) | 006 | migration 0078 |
| 2 | Any profile outside a short list returned HTTP 400 (`is_user_visible` joined a column that does not exist), so the recorder could not read team mates' names | | migration 0079 |
| 3 | A referee could be invited to two games in the same slot, and users without the role could be invited | 079, 080 | migration 0080 |
| 4 | Referee notifications had no match name or a wrong type | 082, 083, 084 | migration 0081 |
| 5 | A match could be kicked off before both lineups were confirmed, and any state change was accepted | 094, 095 | server-side transition table and lineup check |
| 6 | The referee got 403 when confirming lineups for the match they run | | guard accepts the assigned referee |
| 7 | The clock jumped to 12:47 at full time | 106, 107 | `useMatchClock` keeps the period base |
| 8 | Accepting a team invitation after the roster was submitted showed a raw error object | 056, 057 | readable message |
| 9 | The lineup page leaked debug output to non-captains and showed "unknown" for guest players | 085, 089, 090 | fixed |
| 10 | Squads could only contain people with accounts | 038, 040 | guest players (API and UI) |
| 11 | No way to add pitches to a venue or set seeds in the UI; duplicate seeds were accepted | 009, 071, 072 | venue field form, seed input, 409 on a clash |
| 12 | The draw mode could not be chosen, and one team could be put in two games of the same slot | 064, 065 | `draw` option, same-slot guard |
| 13 | A recorder (scorer) could start, finish, forfeit and card matches through the API although the referee console refused them | 129 | referee routes need a referee role; regression test added |
| 14 | The recorder page was open to any signed-in user (writes were rejected by the API) | 149, 150 | "Access denied" for non-officials |
| 15 | The referee audit log showed cards and fouls without a player | 112, 119 | names are stored with the event |
| 16 | A penalty decision was invisible on the scheduling grid and on the match page | 127, 146, 148 | shown as "(pens 4-5)" and "Red Falcons win 5-4 on penalties" |
| 17 | "My match duties" had no teams or times and did not separate assigned from cover duties | 092, 118 | rebuilt list |

## Things found and NOT fixed

- **Suspensions are not enforced.** The disciplinary page labels a player "Suspended" after a red card, but that player stayed in every later
  lineup (Jeevan Fernandes and Farhan Sheikh both played on). How many matches a ban lasts is not defined anywhere. (screenshot 155)
- Matches could be played while the event status was still REGISTRATION_OPEN. The organizer controls to close registration, launch and end
  exist, but nothing requires them. (152 to 157)
- Forfeit goals are in the standings (GF/GA) but not in the "goals" total of the overview (31 against 34).
- Odds ignore seeds; the direct-message header does not show the other person's name; the `min_rest` setting is not enforced by the
  scheduler; a few screens still use `alert()` or `confirm()` (blocked in embedded browsers).
- The hosted Supabase project is unreachable. Migrations 00371 and 0072 to 0081 exist only locally and must be applied to the hosted
  database. Service-role keys that are committed to git (see the notes in `decisions.md`) should be rotated.

## What was not real

- **Match clock.** A 25 minute match was not waited out. Between recorder bursts the match's `half_started_at` was moved back in the
  database (a test-only time shift). Goals therefore show minutes such as 0' and 12', and "minutes played" shows 25'.
- **Squads.** 24 accounts, not 60 or more. Most squad members are guest players (no account), added through the new guest form.
- **Roles.** The three referees also recorded their own matches through the recorder page; the scorer, Priya, recorded only the Final.
- **Fans.** Fan accounts exist and were used to test access control, but no match was live when they were checked, so live predictions,
  reactions and a second simultaneous recorder were not exercised on this tournament (they have automated tests only).
- Repetitive taps (selecting seven starters, tapping players on the recorder) were issued by script through the page's own buttons;
  every request still went through the real UI handlers.

## Verification after the run

- API: 14 test files run one by one, 93 passed and 1 skipped (pre-existing). New: a scorer cannot run the match, guests and seeds,
  referee assignment, draw modes and the same-slot guard, profile visibility, draft event policy.
- Web: 38 vitest tests, `tsc --noEmit` clean, `next build` succeeds.

## All screenshots

### Organizer sign-up, event creation and configuration (001-009)

**001** Register form  
![Register form](001-register-form.jpg)

**002** Register short password rejected  
![Register short password rejected](002-register-short-password-rejected.jpg)

**003** Registered dashboard  
![Registered dashboard](003-registered-dashboard.jpg)

**004** Organizer hub empty  
![Organizer hub empty](004-organizer-hub-empty.jpg)

**005** Create event form  
![Create event form](005-create-event-form.jpg)

**006** Event command centre draft  
![Event command centre draft](006-event-command-centre-draft.jpg)

**007** Event config 12 1 12 groups knockout  
![Event config 12 1 12 groups knockout](007-event-config-12-1-12-groups-knockout.jpg)

**008** Registration open  
![Registration open](008-registration-open.png)

**009** Venue with two fields  
![Venue with two fields](009-venue-with-two-fields.png)


### Accounts for captains, referees, recorder, players and fans (010-033)

**010** Account arjun nair captain  
![Account arjun nair captain](010-account-arjun-nair-captain.png)

**011** Account vikram singh captain  
![Account vikram singh captain](011-account-vikram-singh-captain.png)

**012** Account karan patel captain  
![Account karan patel captain](012-account-karan-patel-captain.png)

**013** Account aditya rao captain  
![Account aditya rao captain](013-account-aditya-rao-captain.png)

**014** Account sameer khan captain  
![Account sameer khan captain](014-account-sameer-khan-captain.png)

**015** Account nikhil das captain  
![Account nikhil das captain](015-account-nikhil-das-captain.png)

**016** Account rahul verma captain  
![Account rahul verma captain](016-account-rahul-verma-captain.png)

**017** Account manav joshi captain  
![Account manav joshi captain](017-account-manav-joshi-captain.png)

**018** Account imran qureshi referee  
![Account imran qureshi referee](018-account-imran-qureshi-referee.png)

**019** Account sunita rao referee  
![Account sunita rao referee](019-account-sunita-rao-referee.png)

**020** Account deepak iyer referee  
![Account deepak iyer referee](020-account-deepak-iyer-referee.png)

**021** Account priya nair recorder  
![Account priya nair recorder](021-account-priya-nair-recorder.png)

**022** Account ishaan gupta player  
![Account ishaan gupta player](022-account-ishaan-gupta-player.png)

**023** Account kabir shah player  
![Account kabir shah player](023-account-kabir-shah-player.png)

**024** Account laksh reddy player  
![Account laksh reddy player](024-account-laksh-reddy-player.png)

**025** Account mohit jain player  
![Account mohit jain player](025-account-mohit-jain-player.png)

**026** Account neel bhatt player  
![Account neel bhatt player](026-account-neel-bhatt-player.png)

**027** Account omkar kulkarni player  
![Account omkar kulkarni player](027-account-omkar-kulkarni-player.png)

**028** Account pranav menon player  
![Account pranav menon player](028-account-pranav-menon-player.png)

**029** Account rishi kapoor player  
![Account rishi kapoor player](029-account-rishi-kapoor-player.png)

**030** Account ananya bose fan  
![Account ananya bose fan](030-account-ananya-bose-fan.png)

**031** Account tara menon fan  
![Account tara menon fan](031-account-tara-menon-fan.png)

**032** Account zoya ali fan  
![Account zoya ali fan](032-account-zoya-ali-fan.png)

**033** Login wrong password rejected  
![Login wrong password rejected](033-login-wrong-password-rejected.png)


### Team registration (captain view) (034-041)

**034** Events list registration open  
![Events list registration open](034-events-list-registration-open.png)

**035** Event public page register cta  
![Event public page register cta](035-event-public-page-register-cta.png)

**036** Team registration form  
![Team registration form](036-team-registration-form.png)

**037** Team registration form filled  
![Team registration form filled](037-team-registration-form-filled.png)

**038** Team draft squad of one new guest form  
![Team draft squad of one new guest form](038-team-draft-squad-of-one-new-guest-form.png)

**039** Submit rejected min squad not met  
![Submit rejected min squad not met](039-submit-rejected-min-squad-not-met.png)

**040** Guest players added via ui  
![Guest players added via ui](040-guest-players-added-via-ui.png)

**041** Duplicate jersey rejected  
![Duplicate jersey rejected](041-duplicate-jersey-rejected.png)


### Friends, requests and direct messages (042-051)

**042** Friends search unknown code message  
![Friends search unknown code message](042-friends-search-unknown-code-message.png)

**043** Friends search own code excluded  
![Friends search own code excluded](043-friends-search-own-code-excluded.png)

**044** Friend request sent to ishaan  
![Friend request sent to ishaan](044-friend-request-sent-to-ishaan.png)

**045** Friends pending outgoing request  
![Friends pending outgoing request](045-friends-pending-outgoing-request.png)

**046** Player gets friend request notification  
![Player gets friend request notification](046-player-gets-friend-request-notification.png)

**047** Incoming friend request accept reject  
![Incoming friend request accept reject](047-incoming-friend-request-accept-reject.png)

**048** Friend request accepted  
![Friend request accepted](048-friend-request-accepted.png)

**049** Direct message page  
![Direct message page](049-direct-message-page.png)

**050** Direct message sent  
![Direct message sent](050-direct-message-sent.png)

**051** Friend request rejected no pending  
![Friend request rejected no pending](051-friend-request-rejected-no-pending.png)


### Team invitations (052-057)

**052** Team invitation notification before name fix  
![Team invitation notification before name fix](052-team-invitation-notification-before-name-fix.png)

**053** Team invitation accepted by player  
![Team invitation accepted by player](053-team-invitation-accepted-by-player.png)

**054** Invitation names team accept or decline  
![Invitation names team accept or decline](054-invitation-names-team-accept-or-decline.png)

**055** Invitation declined  
![Invitation declined](055-invitation-declined.png)

**056** Late accept after submit raw error found  
![Late accept after submit raw error found](056-late-accept-after-submit-raw-error-found.png)

**057** Late accept after submit clean error  
![Late accept after submit clean error](057-late-accept-after-submit-clean-error.png)


### Organizer approval, roster lock and seeds (058-061)

**058** Organizer teams approved  
![Organizer teams approved](058-organizer-teams-approved.png)

**059** Organizer rosters locked  
![Organizer rosters locked](059-organizer-rosters-locked.png)

**060** Captain submitted pending approval  
![Captain submitted pending approval](060-captain-submitted-pending-approval.png)

**061** Organizer team registrations with seed  
![Organizer team registrations with seed](061-organizer-team-registrations-with-seed.png)


### Slots, random draw, reset, seeded draw (062-074)

**062** Slot configurator 12 1 12  
![Slot configurator 12 1 12](062-slot-configurator-12-1-12.png)

**063** Slots generated two pitches  
![Slots generated two pitches](063-slots-generated-two-pitches.png)

**064** Format panel draw options  
![Format panel draw options](064-format-panel-draw-options.png)

**065** Random draw selected  
![Random draw selected](065-random-draw-selected.png)

**066** Scheduling blocked until broadcast  
![Scheduling blocked until broadcast](066-scheduling-blocked-until-broadcast.png)

**067** All fixtures scheduled random  
![All fixtures scheduled random](067-all-fixtures-scheduled-random.png)

**068** Assignment grid random draw  
![Assignment grid random draw](068-assignment-grid-random-draw.png)

**069** Reset schedule confirmation  
![Reset schedule confirmation](069-reset-schedule-confirmation.png)

**070** Schedule cleared back to format setup  
![Schedule cleared back to format setup](070-schedule-cleared-back-to-format-setup.png)

**071** Duplicate seed error first version  
![Duplicate seed error first version](071-duplicate-seed-error-first-version.png)

**072** Duplicate seed error inline  
![Duplicate seed error inline](072-duplicate-seed-error-inline.png)

**073** Seeded draw selected  
![Seeded draw selected](073-seeded-draw-selected.png)

**074** Assignment grid seeded draw  
![Assignment grid seeded draw](074-assignment-grid-seeded-draw.png)


### Referee and scorer roles, assignment (075-082)

**075** Referee code not found  
![Referee code not found](075-referee-code-not-found.png)

**076** Referee granted  
![Referee granted](076-referee-granted.png)

**077** Scorer role granted  
![Scorer role granted](077-scorer-role-granted.png)

**078** Four officials listed  
![Four officials listed](078-four-officials-listed.png)

**079** Referee double booking found before fix  
![Referee double booking found before fix](079-referee-double-booking-found-before-fix.png)

**080** Referee double booking refused  
![Referee double booking refused](080-referee-double-booking-refused.png)

**081** Referees assigned in grid  
![Referees assigned in grid](081-referees-assigned-in-grid.png)

**082** Referee notifications without match names  
![Referee notifications without match names](082-referee-notifications-without-match-names.png)


### Notifications, lineups, access control, duties (083-092)

**083** Referee notifications name the match  
![Referee notifications name the match](083-referee-notifications-name-the-match.png)

**084** Bad notification error found  
![Bad notification error found](084-bad-notification-error-found.png)

**085** Lineup page guest names were unknown  
![Lineup page guest names were unknown](085-lineup-page-guest-names-were-unknown.png)

**086** Lineup guest names fixed submit disabled  
![Lineup guest names fixed submit disabled](086-lineup-guest-names-fixed-submit-disabled.png)

**087** Lineup seven starters selected  
![Lineup seven starters selected](087-lineup-seven-starters-selected.png)

**088** Lineup submitted awaiting referee  
![Lineup submitted awaiting referee](088-lineup-submitted-awaiting-referee.png)

**089** Lineup access denied debug dump found  
![Lineup access denied debug dump found](089-lineup-access-denied-debug-dump-found.png)

**090** Lineup access denied clean  
![Lineup access denied clean](090-lineup-access-denied-clean.png)

**091** Referee assignments list before  
![Referee assignments list before](091-referee-assignments-list-before.png)

**092** Match duties list with teams and times  
![Match duties list with teams and times](092-match-duties-list-with-teams-and-times.png)


### Match 1 end to end (093-107)

**093** Referee console lineups submitted  
![Referee console lineups submitted](093-referee-console-lineups-submitted.png)

**094** Bug kickoff without confirmed lineups  
![Bug kickoff without confirmed lineups](094-bug-kickoff-without-confirmed-lineups.png)

**095** Kickoff blocked until lineups confirmed  
![Kickoff blocked until lineups confirmed](095-kickoff-blocked-until-lineups-confirmed.png)

**096** Both lineups confirmed by referee  
![Both lineups confirmed by referee](096-both-lineups-confirmed-by-referee.png)

**097** Recorder pass logged ball with holder  
![Recorder pass logged ball with holder](097-recorder-pass-logged-ball-with-holder.png)

**098** Recorder shots save tackle recorded  
![Recorder shots save tackle recorded](098-recorder-shots-save-tackle-recorded.png)

**099** Recorder undo wrong goal score restored  
![Recorder undo wrong goal score restored](099-recorder-undo-wrong-goal-score-restored.png)

**100** Recorder offline events queued  
![Recorder offline events queued](100-recorder-offline-events-queued.png)

**101** Referee console stoppage time half time available  
![Referee console stoppage time half time available](101-referee-console-stoppage-time-half-time-available.png)

**102** Referee select player for card  
![Referee select player for card](102-referee-select-player-for-card.png)

**103** Referee yellow card in audit log  
![Referee yellow card in audit log](103-referee-yellow-card-in-audit-log.png)

**104** Referee half time clock frozen  
![Referee half time clock frozen](104-referee-half-time-clock-frozen.png)

**105** Recorder second half running  
![Recorder second half running](105-recorder-second-half-running.png)

**106** Bug full time clock showed 12 47  
![Bug full time clock showed 12 47](106-bug-full-time-clock-showed-12-47.png)

**107** Full time clock fixed 24 00 plus  
![Full time clock fixed 24 00 plus](107-full-time-clock-fixed-24-00-plus.png)


### Group matches: substitution, red card, second yellow, forfeit (108-121)

**108** Match2 recorder first half 1 1  
![Match2 recorder first half 1 1](108-match2-recorder-first-half-1-1.png)

**109** Match2 referee half time start 2nd half  
![Match2 referee half time start 2nd half](109-match2-referee-half-time-start-2nd-half.png)

**110** Match2 substitution modal player on  
![Match2 substitution modal player on](110-match2-substitution-modal-player-on.png)

**111** Match2 substitution in audit log  
![Match2 substitution in audit log](111-match2-substitution-in-audit-log.png)

**112** Match2 red card in audit log  
![Match2 red card in audit log](112-match2-red-card-in-audit-log.png)

**113** Match2 select player for card  
![Match2 select player for card](113-match2-select-player-for-card.png)

**114** Match2 recorder 2 1 sent off player removed  
![Match2 recorder 2 1 sent off player removed](114-match2-recorder-2-1-sent-off-player-removed.png)

**115** Match4 recorder 1 2 second half  
![Match4 recorder 1 2 second half](115-match4-recorder-1-2-second-half.png)

**116** Match10 second yellow auto red in audit log  
![Match10 second yellow auto red in audit log](116-match10-second-yellow-auto-red-in-audit-log.png)

**117** Match10 recorder sent off player removed  
![Match10 recorder sent off player removed](117-match10-recorder-sent-off-player-removed.png)

**118** Dashboard my match duties assigned and cover  
![Dashboard my match duties assigned and cover](118-dashboard-my-match-duties-assigned-and-cover.png)

**119** Match3 yellow card audit log shows player name  
![Match3 yellow card audit log shows player name](119-match3-yellow-card-audit-log-shows-player-name.png)

**120** Match7 forfeit two tap confirm  
![Match7 forfeit two tap confirm](120-match7-forfeit-two-tap-confirm.png)

**121** Match7 forfeit completed 3 0 awarded  
![Match7 forfeit completed 3 0 awarded](121-match7-forfeit-completed-3-0-awarded.png)


### Group stage tables (122-124)

**122** Tournament stats group tables after group stage  
![Tournament stats group tables after group stage](122-tournament-stats-group-tables-after-group-stage.png)

**123** Tournament stats bracket semis filled and standings  
![Tournament stats bracket semis filled and standings](123-tournament-stats-bracket-semis-filled-and-standings.png)

**124** Tournament stats top scorers and assists  
![Tournament stats top scorers and assists](124-tournament-stats-top-scorers-and-assists.png)


### Knockouts: semi-finals, penalties, third place, final (125-131)

**125** Sf1 recorder iron wolves vs coastal kings 1 1  
![Sf1 recorder iron wolves vs coastal kings 1 1](125-sf1-recorder-iron-wolves-vs-coastal-kings-1-1.png)

**126** Sf2 drawn knockout equal penalty score save disabled  
![Sf2 drawn knockout equal penalty score save disabled](126-sf2-drawn-knockout-equal-penalty-score-save-disabled.png)

**127** Sf2 penalty result shown in grid 4 5 red falcons advance  
![Sf2 penalty result shown in grid 4 5 red falcons advance](127-sf2-penalty-result-shown-in-grid-4-5-red-falcons-advance.png)

**128** 3rd place recorder goal undone score back to 0 0  
![3rd place recorder goal undone score back to 0 0](128-3rd-place-recorder-goal-undone-score-back-to-0-0.png)

**129** Final scorer priya denied referee console  
![Final scorer priya denied referee console](129-final-scorer-priya-denied-referee-console.png)

**130** Final recorder priya 1 1 first half  
![Final recorder priya 1 1 first half](130-final-recorder-priya-1-1-first-half.png)

**131** Final bracket iron wolves champions pens shown  
![Final bracket iron wolves champions pens shown](131-final-bracket-iron-wolves-champions-pens-shown.png)


### Stats page of every match (132-148)

**132** Stats m01 iron wolves 3 0 storm riders  
![Stats m01 iron wolves 3 0 storm riders](132-stats-m01-iron-wolves-3-0-storm-riders.png)

**133** Stats m02 coastal kings 2 1 thunder hawks red card  
![Stats m02 coastal kings 2 1 thunder hawks red card](133-stats-m02-coastal-kings-2-1-thunder-hawks-red-card.png)

**134** Stats m03 golden eagles 2 2 red falcons  
![Stats m03 golden eagles 2 2 red falcons](134-stats-m03-golden-eagles-2-2-red-falcons.png)

**135** Stats m04 blue stallions 1 2 night owls  
![Stats m04 blue stallions 1 2 night owls](135-stats-m04-blue-stallions-1-2-night-owls.png)

**136** Stats m05 iron wolves 2 2 red falcons  
![Stats m05 iron wolves 2 2 red falcons](136-stats-m05-iron-wolves-2-2-red-falcons.png)

**137** Stats m06 coastal kings 2 0 night owls  
![Stats m06 coastal kings 2 0 night owls](137-stats-m06-coastal-kings-2-0-night-owls.png)

**138** Stats m07 forfeit golden eagles 3 0 storm riders  
![Stats m07 forfeit golden eagles 3 0 storm riders](138-stats-m07-forfeit-golden-eagles-3-0-storm-riders.png)

**139** Stats m08 thunder hawks 3 0 blue stallions  
![Stats m08 thunder hawks 3 0 blue stallions](139-stats-m08-thunder-hawks-3-0-blue-stallions.png)

**140** Stats m09 iron wolves 1 0 golden eagles  
![Stats m09 iron wolves 1 0 golden eagles](140-stats-m09-iron-wolves-1-0-golden-eagles.png)

**141** Stats m10 blue stallions 1 0 coastal kings red card  
![Stats m10 blue stallions 1 0 coastal kings red card](141-stats-m10-blue-stallions-1-0-coastal-kings-red-card.png)

**142** Stats m11 red falcons 3 1 storm riders  
![Stats m11 red falcons 3 1 storm riders](142-stats-m11-red-falcons-3-1-storm-riders.png)

**143** Stats m12 thunder hawks 2 1 night owls  
![Stats m12 thunder hawks 2 1 night owls](143-stats-m12-thunder-hawks-2-1-night-owls.png)

**144** Stats m16 final iron wolves 2 1 red falcons  
![Stats m16 final iron wolves 2 1 red falcons](144-stats-m16-final-iron-wolves-2-1-red-falcons.png)

**145** Stats m13 sf1 iron wolves 2 1 coastal kings  
![Stats m13 sf1 iron wolves 2 1 coastal kings](145-stats-m13-sf1-iron-wolves-2-1-coastal-kings.png)

**146** Stats m14 sf2 1 1 draw no penalty line bug  
![Stats m14 sf2 1 1 draw no penalty line bug](146-stats-m14-sf2-1-1-draw-no-penalty-line-bug.png)

**147** Stats m15 third place thunder hawks 2 1 coastal kings  
![Stats m15 third place thunder hawks 2 1 coastal kings](147-stats-m15-third-place-thunder-hawks-2-1-coastal-kings.png)

**148** Stats m14 sf2 penalty result shown after fix  
![Stats m14 sf2 penalty result shown after fix](148-stats-m14-sf2-penalty-result-shown-after-fix.png)


### Access control found during the run (149-152)

**149** Bug fan could open recorder console before fix  
![Bug fan could open recorder console before fix](149-bug-fan-could-open-recorder-console-before-fix.png)

**150** Fan recorder access denied after fix  
![Fan recorder access denied after fix](150-fan-recorder-access-denied-after-fix.png)

**151** Fan predict page no open matches after tournament  
![Fan predict page no open matches after tournament](151-fan-predict-page-no-open-matches-after-tournament.png)

**152** Organizer event page status still registration open  
![Organizer event page status still registration open](152-organizer-event-page-status-still-registration-open.png)


### Event lifecycle (153-157)

**153** Organizer registration closed launch button  
![Organizer registration closed launch button](153-organizer-registration-closed-launch-button.png)

**154** Organizer tournament live end button  
![Organizer tournament live end button](154-organizer-tournament-live-end-button.png)

**155** Disciplinary dashboard suspended label not enforced  
![Disciplinary dashboard suspended label not enforced](155-disciplinary-dashboard-suspended-label-not-enforced.png)

**156** Organizer event completed status  
![Organizer event completed status](156-organizer-event-completed-status.png)

**157** Public event page status completed  
![Public event page status completed](157-public-event-page-status-completed.png)


### Tournament-wide stats (158-164)

**158** Stats players hub  
![Stats players hub](158-stats-players-hub.png)

**159** Stats teams hub  
![Stats teams hub](159-stats-teams-hub.png)

**160** Stats yellow cards leaderboard  
![Stats yellow cards leaderboard](160-stats-yellow-cards-leaderboard.png)

**161** Stats top scorers leaderboard  
![Stats top scorers leaderboard](161-stats-top-scorers-leaderboard.png)

**162** Stats tournament analytics  
![Stats tournament analytics](162-stats-tournament-analytics.png)

**163** Stats form hub  
![Stats form hub](163-stats-form-hub.png)

**164** Team page iron wolves champions  
![Team page iron wolves champions](164-team-page-iron-wolves-champions.png)

