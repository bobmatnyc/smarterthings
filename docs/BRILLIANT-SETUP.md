# Brilliant Control Integration Setup Guide

This guide walks you through integrating Brilliant smart home control panels with SmartThings, enabling you to control your Brilliant switches, dimmers, and plugs through the MCP SmartThings dashboard.

## Overview

Brilliant Control panels integrate with SmartThings through the Brilliant mobile app, not via direct API. Once connected, your Brilliant switches, dimmers, and smart plugs appear as SmartThings devices and can be controlled through the MCP dashboard.

**What Works:**
- Switches (on/off control)
- Dimmers (brightness control 0-100%)
- Smart plugs (on/off control)
- Multi-gang panels (each switch appears separately)
- Status reporting

**What Doesn't Sync to SmartThings:**
- Camera feeds and recordings
- Motion sensor data
- Intercom functionality
- Brilliant scenes (use Brilliant app)
- Music playback controls
- Touchscreen interface

**Important:** Brilliant panels remain fully functional for their native features (camera, intercom, music) even when integrated with SmartThings. The integration only exposes switches and plugs.

## Prerequisites

Before you begin, ensure you have:

1. **Brilliant Control Panels** - Any model:
   - Single-gang panel (1 switch)
   - Double-gang panel (2 switches)
   - Three-gang panel (3 switches)
   - Four-gang panel (4 switches)

2. **Brilliant Smart Plugs** (optional):
   - Brilliant Smart Plug (if you have any)

3. **Brilliant Mobile App**:
   - iOS: Download from App Store
   - Android: Download from Google Play
   - Active Brilliant account (free)

4. **SmartThings Account**:
   - SmartThings app installed
   - Active SmartThings account

5. **Network Requirements**:
   - Brilliant panels connected to Wi-Fi
   - Panels showing online in Brilliant app
   - SmartThings hub (if required by your setup)

**Note:** Unlike some integrations, Brilliant does NOT require a separate hub. The panels connect directly to Wi-Fi.

## Step-by-Step Setup

### Step 1: Install Brilliant Hardware

If you haven't already installed your Brilliant panels:

1. **Safety First:**
   - ⚠️ **TURN OFF POWER** at the circuit breaker
   - Verify power is off with a voltage tester
   - If uncomfortable with electrical work, hire a licensed electrician

2. **Remove Existing Switch:**
   - Remove old switch cover plate
   - Unscrew old switch from wall box
   - Note wire connections (take a photo)

3. **Install Brilliant Panel:**
   - Connect wires according to Brilliant instructions:
     - Line (hot) wire → Line terminal
     - Load wire(s) → Load terminal(s)
     - Neutral wire → Neutral terminal (required)
     - Ground wire → Ground terminal
   - Multi-gang panels have multiple load terminals
   - Secure panel to wall box with provided screws

4. **Attach Faceplate:**
   - Snap faceplate onto panel
   - Ensure it's secure and flush

5. **Restore Power:**
   - Turn circuit breaker back on
   - Panel should power up (Brilliant logo appears)

**Info:** Brilliant requires a neutral wire. If your wall box doesn't have neutral, consult an electrician about running new wire.

### Step 2: Set Up Brilliant App

1. **Create Brilliant Account:**
   - Open Brilliant app
   - Tap "Create Account" or "Sign Up"
   - Enter email and create password
   - Verify email address

2. **Add Your Home:**
   - Tap "Add Home" or "+"
   - Name your home (e.g., "My House")
   - Set timezone and location

3. **Connect Panel to Wi-Fi:**
   - On the Brilliant panel touchscreen:
     - Swipe down from top
     - Tap Settings (gear icon)
     - Tap "Wi-Fi"
     - Select your Wi-Fi network
     - Enter Wi-Fi password
     - Wait for "Connected" status

4. **Add Panel to App:**
   - In Brilliant app, tap "Add Device"
   - Select "Brilliant Control"
   - App will scan for nearby panels
   - Select your panel from the list
   - Follow pairing instructions

5. **Configure Panel:**
   - Name the panel (e.g., "Kitchen Panel")
   - Assign to a room
   - Name each switch:
     - Switch 1: "Kitchen Overhead"
     - Switch 2: "Kitchen Island" (for multi-gang)
   - Set switch types (switch vs dimmer)
   - Test each switch controls the correct load

**Screenshot placeholder: Brilliant app showing panel configuration**

### Step 3: Connect Brilliant to SmartThings

This is done entirely through the Brilliant mobile app:

1. **Open Brilliant App:**
   - Ensure you're logged in
   - Verify panels show as "Online"

2. **Access Integrations:**
   - Tap Menu (≡) or More
   - Select "Integrations" or "Connected Services"
   - Scroll to find "SmartThings"

3. **Connect SmartThings:**
   - Tap "SmartThings" integration
   - Tap "Connect" or "Link Account"
   - You'll be redirected to SmartThings login
   - Sign in with your SmartThings account credentials
   - Review permissions requested
   - Tap "Authorize" or "Allow"

4. **Select Devices to Sync:**
   - Brilliant will show a list of your panels and switches
   - By default, all are selected
   - Uncheck any devices you don't want in SmartThings
   - Tap "Sync" or "Connect Devices"

5. **Wait for Sync:**
   - Sync typically takes 30-60 seconds
   - App will show "Connected" when complete
   - You may see a confirmation notification

**Screenshot placeholder: Brilliant app integrations page with SmartThings**

### Step 4: Verify Devices in SmartThings

1. **Open SmartThings App:**
   - Tap "Devices" tab (bottom navigation)
   - Look for newly added devices

2. **Check Device List:**
   - Brilliant switches appear with their assigned names
   - Example: "Kitchen Overhead", "Kitchen Island"
   - Device type: "Switch" or "Dimmer"
   - Room: Assigned based on Brilliant room (or "No room assigned")

3. **Assign Rooms (if needed):**
   - Tap a Brilliant device
   - Tap Settings (gear icon)
   - Select "Room"
   - Choose the appropriate SmartThings room
   - Repeat for all Brilliant devices

4. **Test Device Control:**
   - In SmartThings app, tap a Brilliant switch
   - Tap the power icon to turn on/off
   - Physical lights should respond
   - For dimmers, adjust the brightness slider
   - Verify changes happen in 1-3 seconds

**Screenshot placeholder: SmartThings app showing Brilliant devices**

### Step 5: Verify in MCP Dashboard

1. **Open MCP SmartThings Dashboard:**
   - Navigate to your dashboard URL (e.g., http://localhost:5181)
   - Or use MCP interface in Claude Desktop

2. **Locate Brilliant Devices:**
   - Brilliant devices appear in the main device list
   - Filter by room if needed
   - Look for switch and dimmer icons

3. **Test Dashboard Control:**
   - Click a Brilliant switch to toggle on/off
   - For dimmers, use the brightness slider
   - Verify physical lights respond
   - Check status updates correctly

**Screenshot placeholder: MCP dashboard showing Brilliant devices**

## What Gets Exposed to SmartThings

### Switches (On/Off Only)

**Device Type:** Switch
**Capabilities:** `switch`
**Commands:** `on`, `off`
**Status:** Reports current state (on/off)

**What This Controls:**
- The load connected to that switch position
- Example: Ceiling lights, outlets, fans (if on/off only)

**Example:**
```
Device: Kitchen Overhead
Type: Switch
Capabilities: switch
Current State: on
Commands Available:
  - Turn on
  - Turn off
```

### Dimmers (Brightness Control)

**Device Type:** Dimmer
**Capabilities:** `switch`, `switchLevel`
**Commands:** `on`, `off`, `setLevel(0-100)`
**Status:** Reports on/off state and brightness level

**What This Controls:**
- Dimmable loads (LED, incandescent, ELV)
- Brightness from 0% (off) to 100% (full brightness)

**Example:**
```
Device: Living Room Lights
Type: Dimmer
Capabilities: switch, switchLevel
Current State: on
Current Level: 65%
Commands Available:
  - Turn on
  - Turn off
  - Set brightness (0-100%)
```

**Note:** Brilliant dimmers automatically detect load type. If you're experiencing flickering, check load compatibility in Brilliant app settings.

### Smart Plugs

**Device Type:** Switch
**Capabilities:** `switch`
**Commands:** `on`, `off`
**Status:** Reports current state and power usage (if supported)

**What This Controls:**
- Devices plugged into the Brilliant Smart Plug
- Example: Lamps, fans, small appliances

**Example:**
```
Device: Table Lamp
Type: Switch
Capabilities: switch, powerMeter (some models)
Current State: off
Commands Available:
  - Turn on
  - Turn off
```

## Multi-Gang Panels

Multi-gang Brilliant panels (2, 3, or 4 switches) appear as separate devices in SmartThings:

### How They Appear

**Physical Panel:** Brilliant 3-Gang Kitchen Panel

**SmartThings Devices:**
1. "Kitchen Overhead" (switch 1)
2. "Kitchen Island" (switch 2)
3. "Kitchen Under Cabinet" (switch 3)

**Key Points:**
- Each switch is a separate SmartThings device
- Control each switch independently
- No special grouping in SmartThings
- Use SmartThings scenes to control multiple switches together

### Example Setup

**Panel:** Brilliant 4-gang in Master Bedroom

**Configuration:**
```
Switch 1: Master Ceiling Fan (switch - on/off only)
Switch 2: Master Overhead Lights (dimmer - 0-100%)
Switch 3: Master Reading Lights (dimmer - 0-100%)
Switch 4: Master Closet Light (switch - on/off only)
```

**In SmartThings Dashboard:**
- 4 separate devices appear
- 2 switches, 2 dimmers
- All assigned to "Master Bedroom" room
- Control individually or create scenes

**Creating a Scene:**
```
Scene Name: "Bedtime"
Actions:
  - Master Ceiling Fan: Off
  - Master Overhead Lights: Off
  - Master Reading Lights: 30%
  - Master Closet Light: Off
```

## What Doesn't Sync to SmartThings

### Camera Functionality

**What's NOT Available:**
- Live camera feed
- Recorded video clips
- Motion detection from camera
- Two-way audio

**Workaround:** Use Brilliant app for all camera features. These remain fully functional on the panel touchscreen.

### Motion Sensor

**What's NOT Available:**
- Motion detection events
- Occupancy status
- Motion-triggered automations via SmartThings

**Workaround:**
- Use Brilliant app to create motion-based Brilliant scenes
- For SmartThings automations, use separate motion sensors
- Or use SmartThings-compatible motion sensors

**Tip:** Brilliant's motion sensor still works for native Brilliant features (auto-dimming touchscreen, presence detection for Brilliant scenes).

### Intercom Features

**What's NOT Available:**
- Intercom calls between panels
- Announcements
- Drop-in functionality

**Workaround:** Use Brilliant app or panel touchscreen for intercom. This is a Brilliant-exclusive feature.

### Brilliant Scenes

**What's NOT Available:**
- Executing Brilliant scenes from SmartThings
- Viewing Brilliant scenes in SmartThings
- Editing Brilliant scenes via SmartThings

**Workaround:**
1. **For Brilliant-only devices:** Create and use scenes in Brilliant app
2. **For cross-platform scenes:** Create SmartThings routines that include Brilliant switches
3. **Hybrid approach:** Use both (Brilliant scenes for instant local control, SmartThings routines for complex cross-platform automation)

### Music Playback

**What's NOT Available:**
- Music streaming controls
- Volume adjustment
- Playback status

**Workaround:** Control music directly from panel touchscreen or Brilliant app.

### Touchscreen Interface

**What's NOT Available:**
- Custom touchscreen layouts
- Displaying device controls on Brilliant panel
- SmartThings dashboard on Brilliant screen

**Workaround:** Brilliant panels and SmartThings dashboards are separate interfaces. Use each for its strengths.

## Troubleshooting

### Issue: Brilliant devices not appearing in SmartThings

**Possible Causes:**
- Integration not connected
- Devices not selected for sync
- SmartThings account authorization issue

**Solutions:**

1. **Verify Integration Status:**
   - Brilliant app → Menu → Integrations → SmartThings
   - Should show "Connected" with a green checkmark
   - If showing "Disconnected", tap to re-authorize

2. **Re-sync Devices:**
   - Brilliant app → Menu → Integrations → SmartThings
   - Tap "Manage Devices" or "Sync Devices"
   - Ensure all desired devices are checked
   - Tap "Sync" or "Save"
   - Wait 60 seconds, then check SmartThings app

3. **Disconnect and Reconnect:**
   - Brilliant app → SmartThings integration → "Disconnect"
   - Confirm disconnection
   - Wait 30 seconds
   - Tap "Connect" and re-authorize
   - Re-select devices to sync

4. **Check SmartThings Linked Services:**
   - SmartThings app → Menu → Settings → Linked Services
   - Look for "Brilliant" in the list
   - If not present, integration failed (retry from Brilliant app)
   - If present but grayed out, tap to re-authorize

### Issue: Brilliant switch showing "Unavailable" or "Offline"

**Possible Causes:**
- Brilliant panel lost Wi-Fi connection
- Panel powered off
- SmartThings cloud issue

**Solutions:**

1. **Check Panel Wi-Fi:**
   - On Brilliant panel, swipe down from top
   - Look at Wi-Fi icon (should show signal strength)
   - If disconnected, go to Settings → Wi-Fi → Reconnect
   - Verify internet connectivity

2. **Check Panel in Brilliant App:**
   - Open Brilliant app
   - Check if panel shows "Online"
   - If "Offline", troubleshoot panel connectivity first
   - Restart panel if needed (power cycle at breaker)

3. **Refresh SmartThings:**
   - SmartThings app → tap the Brilliant device
   - Pull down to refresh status
   - May take 10-20 seconds to update

4. **Power Cycle Panel:**
   - ⚠️ Turn off circuit breaker for the panel
   - Wait 30 seconds
   - Turn circuit breaker back on
   - Wait for panel to boot (1-2 minutes)
   - Check status in both apps

### Issue: Delay when controlling Brilliant devices

**Expected Behavior:**
- 1-3 second delay is normal for cloud-based control
- Brilliant app → Panel → Light = instant (local)
- SmartThings → Cloud → Brilliant Cloud → Panel → Light = 1-3 seconds

**If Delay is Longer (5+ seconds):**

1. **Check Internet Speed:**
   - Test your internet connection speed
   - Slow upload speed can cause delays
   - Recommended: 5 Mbps upload minimum

2. **Check Wi-Fi Signal:**
   - Ensure Brilliant panel has strong Wi-Fi signal
   - If signal weak, consider Wi-Fi extender
   - Panel Settings → Wi-Fi → Check signal strength

3. **Network Congestion:**
   - Other devices using bandwidth can cause delays
   - Prioritize Brilliant panels in router QoS settings (if available)
   - Reduce network traffic during testing

**Mitigation:**
- Use physical panel controls or Brilliant app for instant response
- Use SmartThings for scheduled automations (delay doesn't matter)
- For time-critical scenes, create in Brilliant app (local execution)

### Issue: Dimmer brightness not matching expectations

**Possible Causes:**
- Incompatible bulb type
- Minimum brightness setting
- Load calibration needed

**Solutions:**

1. **Check Bulb Compatibility:**
   - Brilliant dimmers work with most dimmable LEDs
   - Non-dimmable LEDs will flicker or not dim
   - Replace with dimmable LEDs if needed
   - Check Brilliant compatibility list

2. **Adjust Minimum Brightness:**
   - Brilliant app → Device → Settings → Minimum Brightness
   - Set to lowest level before bulbs flicker
   - This prevents bulbs from turning off when dimming low
   - SmartThings respects this minimum

3. **Calibrate Load:**
   - Brilliant panels auto-calibrate, but you can manually adjust
   - Brilliant app → Device → Settings → Load Type
   - Select correct type (LED, Incandescent, etc.)
   - Save and test dimming again

4. **Check Percentage in Both Apps:**
   - Set brightness to 50% in SmartThings
   - Check actual brightness on Brilliant panel
   - If they match, working correctly
   - If different, try re-syncing integration

### Issue: Multiple panels but only some syncing

**Possible Causes:**
- Devices not selected for sync
- Some panels offline during initial sync
- Brilliant account access issues

**Solutions:**

1. **Check Device Selection:**
   - Brilliant app → Integrations → SmartThings → Manage Devices
   - Verify all desired panels are checked
   - Tap "Sync" to update

2. **Verify All Panels Online:**
   - Brilliant app → Devices
   - Ensure all panels show "Online"
   - Offline panels won't sync to SmartThings

3. **Re-sync Integration:**
   - Disconnect SmartThings integration
   - Ensure all panels are online
   - Reconnect integration
   - Select all devices
   - Sync

## Advanced Features

### Cross-Platform Automations

Combine Brilliant switches with other SmartThings devices:

**Example 1: Good Morning Routine**
```
Trigger: 7:00 AM on weekdays
Actions:
  - Brilliant "Bedroom Overhead": On (50% brightness)
  - Brilliant "Bedroom Reading Light": On (30% brightness)
  - SmartThings Smart Plug "Coffee Maker": On
  - Nest Thermostat: Set to 70°F
  - Sonos Speaker: Play morning playlist
```

**Example 2: Movie Time Scene**
```
Trigger: User activates "Movie Time" scene
Actions:
  - Brilliant "Living Room Overhead": Off
  - Brilliant "Living Room Accent": On (10% brightness)
  - SmartThings Smart TV: On
  - Philips Hue Light Strip: Set to red (5% brightness)
  - Brilliant "Kitchen Lights": Off
```

**Example 3: Presence-Based Lighting**
```
Trigger: SmartThings arrival sensor detects arrival
Conditions: Sun has set
Actions:
  - Brilliant "Entry Lights": On (100%)
  - Brilliant "Hallway Lights": On (80%)
  - Wait 5 minutes, then dim to 50%
```

### Voice Control Integration

Once integrated with SmartThings, control Brilliant devices via voice:

**Alexa (via SmartThings Skill):**
```
"Alexa, turn on the kitchen lights"
"Alexa, set bedroom lights to 30 percent"
"Alexa, turn off all brilliant switches"
```

**Google Assistant (via SmartThings Integration):**
```
"Hey Google, turn on kitchen overhead"
"Hey Google, dim living room lights to 40 percent"
"Hey Google, turn off bedroom lights"
```

**Setup:**
1. Connect SmartThings to Alexa or Google Home
2. Brilliant devices automatically become available
3. Use device names from SmartThings for voice commands

**Tip:** Keep device names short and unique for better voice recognition. "Kitchen main" works better than "Kitchen overhead recessed LED lights."

### Scheduling and Away Mode

**Scheduled Control:**
```
Automation: "Porch Light Schedule"
Trigger: Sunset
Actions:
  - Brilliant "Front Porch Light": On (100%)

Trigger: Sunrise
Actions:
  - Brilliant "Front Porch Light": Off
```

**Away Mode:**
```
Automation: "Vacation Lighting"
Trigger: Between 6:00 PM and 11:00 PM
Conditions: Away mode enabled
Actions:
  - Random selection of Brilliant switches
  - Turn on for 30-90 minutes
  - Then turn off
  - Repeat with different switches
```

## Best Practices

### 1. Naming Conventions

Use clear, consistent names:
- ✅ "Kitchen Island Lights" (specific, clear)
- ❌ "Switch 2" (unclear, generic)
- ✅ "Master Bedroom Reading Lights" (descriptive)
- ❌ "BR Lights" (ambiguous abbreviation)

**Why:** Voice control and dashboard filtering work better with clear names.

### 2. Room Organization

Assign all Brilliant devices to SmartThings rooms:
1. Match rooms between Brilliant and SmartThings apps
2. Use consistent room names
3. This enables "turn off all kitchen lights" voice commands

### 3. Load Compatibility

Before installing dimmers:
- Verify bulbs are dimmable
- Check total wattage doesn't exceed panel rating
- Use LED-compatible dimmers for LED bulbs
- Test dimming before final installation

**Brilliant Dimmer Ratings:**
- 150W LED / CFL
- 600W incandescent / halogen
- Check specific model specs

### 4. Network Reliability

Brilliant panels require solid Wi-Fi:
- Place router centrally or use mesh network
- Avoid installing panels in Wi-Fi dead zones
- Test Wi-Fi signal strength at panel location before installation
- Consider PoE (Power over Ethernet) models for critical locations

### 5. Hybrid Control Strategy

Leverage strengths of both systems:
- **Brilliant app:** Camera, intercom, instant local control, Brilliant scenes
- **SmartThings:** Cross-platform automation, voice control, geofencing
- **MCP Dashboard:** Monitoring, AI-powered control, unified interface

Don't try to force everything through one system.

## Limitations and Workarounds

### Limitation 1: No Camera Access

**What's Missing:** Camera feed not available in SmartThings or MCP dashboard

**Workaround:**
- Use Brilliant app for camera access
- For security monitoring, add SmartThings-compatible cameras
- Use Brilliant camera for convenience, dedicated cameras for security

### Limitation 2: No Motion Sensor Integration

**What's Missing:** Motion sensor on Brilliant panel doesn't trigger SmartThings automations

**Workaround:**
- Add SmartThings motion sensors in rooms where needed
- Use Brilliant motion sensor for Brilliant-native features only
- Consider SmartThings multipurpose sensors

### Limitation 3: Scene Control

**What's Missing:** Cannot execute Brilliant scenes from SmartThings

**Workaround:**
- Create equivalent SmartThings routines
- Use SmartThings routines for cross-platform control
- Use Brilliant scenes for instant, local-only control

**Example:**
- Brilliant Scene "Dinner Time" (instant, local)
- SmartThings Routine "Dinner Time" (includes other devices, cloud-based)

### Limitation 4: Touchscreen Dashboard

**What's Missing:** Cannot display SmartThings dashboard on Brilliant touchscreen

**Workaround:**
- Use Brilliant touchscreen for Brilliant controls only
- Use separate tablet for SmartThings dashboard if desired
- Or use MCP dashboard on computer/phone

## Comparison: Brilliant vs. Traditional Smart Switches

| Feature | Brilliant Panel | Traditional Smart Switch | Winner |
|---------|----------------|--------------------------|--------|
| **SmartThings Integration** | ✅ Via Brilliant app | ✅ Native | Tie |
| **Physical Controls** | ✅ Touch + buttons | ✅ Buttons only | Brilliant |
| **Camera** | ✅ Built-in | ❌ None | Brilliant |
| **Intercom** | ✅ Built-in | ❌ None | Brilliant |
| **Music Control** | ✅ Built-in | ❌ None | Brilliant |
| **Multi-Gang** | ✅ Single device | Multiple devices | Brilliant |
| **Price** | $$$ (High) | $ (Low) | Traditional |
| **Installation** | Complex (requires neutral) | Varies | Traditional |
| **Status LED** | Touchscreen | Indicator light | Brilliant |
| **Response Time (Local)** | Instant | Instant | Tie |
| **Response Time (SmartThings)** | 1-3 seconds | 1-3 seconds | Tie |

**Recommendation:**
- **Brilliant:** High-traffic areas where you want touchscreen control, camera, intercom
- **Traditional:** Other rooms where cost is a factor and basic switching is sufficient
- **Mix Both:** Brilliant in main areas, traditional switches elsewhere

## Getting Help

### Official Resources

- **Brilliant Support:** https://www.brilliant.tech/support
- **Brilliant Community:** https://community.brilliant.tech/
- **SmartThings Community:** https://community.smartthings.com/
- **SmartThings Support:** https://support.smartthings.com/

### Contact Support

**Brilliant Support:**
- Email: support@brilliant.tech
- Phone: Check website for current number
- Live Chat: Available in Brilliant app

**For Integration Issues:**
1. First, check if issue is Brilliant-specific or SmartThings-specific
2. Test device in native app (Brilliant or SmartThings)
3. Contact support for the system where issue appears

## Frequently Asked Questions

**Q: Can I control Brilliant switches when SmartThings is down?**
A: Yes. Physical controls and Brilliant app always work. SmartThings integration is additional functionality only.

**Q: Do Brilliant devices support local control in SmartThings?**
A: No. Control goes through cloud (SmartThings Cloud → Brilliant Cloud → Panel). This causes 1-3 second delay.

**Q: Can I use the camera feed in automations?**
A: No. Camera is Brilliant-exclusive. Use SmartThings-compatible cameras if you need camera triggers.

**Q: Will firmware updates affect SmartThings integration?**
A: Brilliant automatically updates panel firmware. Most updates don't affect SmartThings integration, but rarely you may need to re-sync.

**Q: Can I have multiple Brilliant accounts linked to SmartThings?**
A: One Brilliant account per SmartThings account. If you have multiple locations, add all panels to one Brilliant account.

**Q: Do Brilliant dimmers work with smart bulbs (Philips Hue, LIFX)?**
A: Not recommended. Use Brilliant switches (always on) with smart bulbs, or use dumb bulbs with Brilliant dimmers. Don't dim smart bulbs with smart dimmers.

**Q: Can I remove a panel from Brilliant without affecting SmartThings?**
A: If you remove a panel from Brilliant app, it disappears from SmartThings too. They stay synchronized.

**Q: How do I rename devices?**
A: Rename in Brilliant app. The new name syncs to SmartThings automatically (may take a few minutes).

## Next Steps

After completing setup:

1. ✅ Test all Brilliant switches and dimmers in dashboard
2. ✅ Verify room assignments in both apps
3. ✅ Create cross-platform automations if desired
4. ✅ Set up voice control (Alexa/Google)
5. ✅ Explore Brilliant native features (camera, intercom)

**Related Guides:**
- [Lutron Setup Guide](LUTRON-SETUP.md)
- [SmartThings OAuth Setup](SMARTAPP_SETUP.md)
- [Installation Guide](installation-guide.md)

---

**Last Updated:** 2025-12-02
**Integration Version:** SmartThings API v1.0
**Supported Brilliant Models:** All Brilliant Control panels, Brilliant Smart Plugs
