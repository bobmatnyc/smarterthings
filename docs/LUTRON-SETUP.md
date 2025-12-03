# Lutron Integration Setup Guide

This guide walks you through integrating Lutron lighting and shade control systems with SmartThings, enabling you to control your Lutron devices through the MCP SmartThings dashboard.

## Overview

Lutron devices integrate with SmartThings through official integrations, not direct API connections. Once connected, your Lutron switches, dimmers, shades, and sensors appear as SmartThings devices and can be controlled through the MCP dashboard.

**What Works:**
- Switches (on/off control)
- Dimmers (brightness control)
- Shades and blinds (open/close/position)
- Pico remote button presses (as triggers)
- Occupancy and vacancy sensors

**What Doesn't Work:**
- Creating new Lutron scenes (use Lutron app)
- Modifying Pico remote programming (use Lutron app)
- Adjusting fade rates or advanced timing
- Direct firmware updates

## Prerequisites

Before you begin, ensure you have:

1. **Lutron System** - One of the supported systems:
   - Caseta (most common, residential)
   - RadioRA 2 (advanced residential)
   - HomeWorks QS (commercial/high-end)

2. **Lutron Bridge/Processor** - Required hardware:
   - Caseta: Lutron Smart Bridge or Smart Bridge Pro
   - RadioRA 2: RadioRA 2 Main Repeater
   - HomeWorks QS: HomeWorks QS Processor

3. **SmartThings Hub** - Any model:
   - SmartThings Hub v2 or v3
   - Aeotec Smart Home Hub
   - SmartThings Station

4. **Lutron App Installed** - For initial setup:
   - Caseta: Lutron Caseta app (iOS/Android)
   - RadioRA 2: RadioRA 2 app
   - HomeWorks QS: HomeWorks app

5. **Working Lutron System** - Devices already configured in Lutron app

6. **Same Network** - Both hubs on the same local network

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [MCP Dashboard Integration](#mcp-dashboard-integration)
5. [Supported Device Types](#supported-device-types)
6. [Multi-Location Setups](#multi-location-setups)
7. [Integration Verification Checklist](#integration-verification-checklist)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Features](#advanced-features)
10. [Limitations](#limitations)
11. [System Comparison](#system-comparison)
12. [Best Practices](#best-practices)
13. [Supported Lutron Devices & Capabilities](#supported-lutron-devices--capabilities)
14. [Getting Help](#getting-help)
15. [Next Steps](#next-steps)

## Step-by-Step Setup

### Step 1: Install and Configure Lutron Devices

If you haven't already set up your Lutron system:

1. **Install Lutron Bridge:**
   - Plug the Lutron bridge into power
   - Connect bridge to your router via Ethernet cable
   - Wait for the bridge status light to turn solid (not blinking)

2. **Set Up Lutron App:**
   - Download the appropriate Lutron app for your system
   - Create a Lutron account (or sign in)
   - Follow in-app instructions to add the bridge
   - Name your bridge location (e.g., "Home")

3. **Add Lutron Devices:**
   - In the Lutron app, tap "Add" or "+"
   - Follow pairing instructions for each device type:
     - **Switches/Dimmers:** Hold setup button until LED blinks rapidly
     - **Shades:** Press and hold programming button on motor
     - **Pico Remotes:** Press and hold favorite + off buttons
     - **Sensors:** Press setup button on sensor
   - Assign devices to rooms in the Lutron app
   - Test each device works in the Lutron app

**Screenshot placeholder: Lutron app showing devices in rooms**

### Step 2: Link Lutron to SmartThings

The integration method depends on your Lutron system:

#### For Caseta Systems

1. **Open SmartThings App:**
   - Tap "Devices" (bottom navigation)
   - Tap "+" (top right)
   - Select "Add device"

2. **Search for Lutron:**
   - In the "By brand" section, tap "Lutron"
   - Or use search and type "Lutron Caseta"
   - Select "Lutron Caseta" from results

3. **Connect Systems:**
   - Tap "Connect" or "Link account"
   - You'll be redirected to Lutron login
   - Sign in with your Lutron account credentials
   - Select which Lutron location to connect (if you have multiple)
   - Tap "Authorize" to grant SmartThings access

4. **Wait for Discovery:**
   - SmartThings will automatically discover all Lutron devices
   - This may take 1-2 minutes
   - You'll see a list of discovered devices

5. **Assign Rooms:**
   - For each Lutron device, select a SmartThings room
   - Recommended: Use the same room names as in Lutron app
   - Tap "Done" when finished

**Screenshot placeholder: SmartThings showing Lutron integration page**

#### For RadioRA 2 Systems

1. **Prerequisites:**
   - RadioRA 2 Main Repeater with firmware 9.0 or higher
   - RadioRA 2 app installed and working
   - Network access to the Main Repeater

2. **Enable Integration:**
   - Open RadioRA 2 app
   - Go to Settings → Integration
   - Enable "SmartThings Integration"
   - Note the IP address of your Main Repeater

3. **Add to SmartThings:**
   - Follow Steps 1-5 from Caseta instructions above
   - Select "Lutron RadioRA 2" instead of Caseta
   - You may need to enter the Main Repeater IP address manually

#### For HomeWorks QS Systems

HomeWorks QS integration typically requires professional setup:

1. **Contact Lutron:**
   - HomeWorks QS is a commercial system
   - Contact your Lutron dealer or integrator
   - Professional configuration is usually required

2. **Integration Requirements:**
   - HomeWorks QS processor with network access
   - Specific firmware version (check with dealer)
   - May require custom programming

**Info:** For HomeWorks QS systems, consult with your Lutron integrator for SmartThings compatibility.

### Step 3: Verify Devices in Dashboard

1. **Open MCP SmartThings Dashboard:**
   - Navigate to your dashboard URL (e.g., http://localhost:5181)
   - Or use the MCP interface in Claude Desktop

2. **Check Device List:**
   - Your Lutron devices should appear in the device list
   - They will be labeled with their Lutron names
   - Room assignments should match what you configured

3. **Test Device Control:**
   - Try turning a Lutron switch on/off
   - Adjust a dimmer brightness level
   - Open/close a shade
   - Verify changes happen on the physical devices

**Screenshot placeholder: Dashboard showing Lutron devices**

### Step 4: Room Organization (Optional)

For better organization:

1. **Group Lutron Devices:**
   - In SmartThings app, create rooms that match your Lutron layout
   - Assign Lutron devices to appropriate rooms
   - This helps with filtering in the dashboard

2. **Naming Convention:**
   - Keep device names consistent with Lutron app
   - Example: "Kitchen Main Lights" (not "Light 1")
   - Clear names make voice control easier

## MCP Dashboard Integration

Once Lutron devices are linked via the SmartThings app, they appear automatically in the MCP SmartThings Dashboard with full control capabilities.

### How It Works

**Integration Path:**
```
MCP Dashboard → SmartThings API → Lutron Cloud → Lutron Bridge → Physical Device
```

**Platform Detection:**
Lutron devices appear with platform indicator:
- Device Name: "Kitchen Island Lights"
- Platform: SmartThings (Lutron)
- Type: Dimmer
- Capabilities: switch, switchLevel

### Device Discovery

**Automatic Sync:**
- Lutron devices sync to MCP within 2-3 minutes of SmartThings integration
- No additional configuration required
- Devices inherit room assignments from SmartThings app

**Device Identification:**
Lutron devices in MCP dashboard show:
- Manufacturer: Lutron Electronics Co., Inc.
- Model: May show "Lutron Caseta" or specific model (PD-6WCL, etc.)
- Platform tag: "SmartThings (Lutron)"

### Control Capabilities

**Unified Interface:**
Lutron devices use the same control interface as native SmartThings devices:

**Switch Controls:**
- Toggle button: On/Off
- Status indicator: Real-time state (on/off)
- Response time: 1-3 seconds

**Dimmer Controls:**
- Brightness slider: 0-100%
- Quick preset buttons: 25%, 50%, 75%, 100%
- Live brightness display
- Response time: 1-3 seconds

**Shade Controls:**
- Position slider: 0% (closed) to 100% (open)
- Quick actions: Open, Close, Stop
- Position display: Current percentage
- Response time: 2-4 seconds (mechanical movement)

### MCP Tool Usage Examples

**Example 1: Turn On Kitchen Lights (Lutron Dimmer)**
```typescript
// MCP Tool: turn_on_device
{
  "deviceId": "lutron-dimmer-kitchen-abc123"
}

// Response:
// "Device lutron-dimmer-kitchen-abc123 turned on successfully"
// Physical light turns on within 1-2 seconds
```

**Example 2: Dim Living Room to 30%**
```typescript
// MCP Tool: set_level
{
  "deviceId": "lutron-dimmer-living-def456",
  "level": 30
}

// Response:
// "Device lutron-dimmer-living-def456 set to 30%"
// Physical light dims to 30% brightness within 1-3 seconds
```

**Example 3: List All Lutron Devices in Bedroom**
```typescript
// MCP Tool: list_devices_by_room
{
  "roomName": "Bedroom"
}

// Returns:
// Found 4 device(s) in Bedroom:
// - Bedroom Overhead (lutron-dimmer-bed-123)
//   Platform: SmartThings (Lutron)
//   Type: Dimmer
//   Capabilities: switch, switchLevel
//   Status: On (75%)
//
// - Bedroom Shades (lutron-shade-bed-789)
//   Platform: SmartThings (Lutron)
//   Type: Window Shade
//   Capabilities: windowShade, switchLevel
//   Status: Open (100%)
```

### Response Time Expectations

**Command Latency Breakdown:**

| Path Segment | Latency | Protocol |
|--------------|---------|----------|
| MCP → SmartThings Cloud | 50-150ms | HTTPS REST |
| SmartThings → Lutron Cloud | 100-300ms | OAuth Webhook |
| Lutron Cloud → Bridge | 50-200ms | Encrypted WS |
| Bridge → Device | 30-100ms | RF (433 MHz) |
| **Total** | **230ms - 750ms** | Multi-cloud |

**Comparison:**
- Lutron App → Bridge → Device: 50-150ms (local LEAP protocol)
- MCP Dashboard → Device: 230-750ms (cloud routing)

**Why Slower?**
MCP uses cloud routing through two vendors (SmartThings + Lutron), while the Lutron app communicates directly with the bridge via local network.

**When to Use Each:**
- **Lutron App:** Instant physical control (movie scenes, time-critical lighting)
- **MCP Dashboard:** Cross-platform automation, AI control, unified device management

### MCP-Specific Limitations

**Cannot Do via MCP:**
1. Execute native Lutron scenes (create equivalent SmartThings scenes)
2. Program Pico remote buttons (use Pico events as automation triggers)
3. Adjust fade rates (configure in Lutron app, applies universally)
4. Change sensor sensitivity (configure in Lutron app settings)
5. Update Lutron bridge firmware (use Lutron app)

**Workarounds:**
- Use Lutron app for Lutron-native features
- Use MCP for cross-platform automations and AI control
- Hybrid approach: Lutron scenes for instant control, SmartThings routines for complex automation

## Supported Device Types

### Switches

**Lutron Models:**
- PD-5WS (Caseta switch)
- RRD-6NA (RadioRA 2 switch)
- All standard on/off switches

**Dashboard Control:**
- ✅ Turn on/off
- ✅ Status reporting
- ❌ Scene control (use Lutron app)

**Example:**
```
Device: Kitchen Overhead
Type: Switch
Capabilities: switch
Commands: on, off
```

### Dimmers

**Lutron Models:**
- PD-6WCL (Caseta dimmer)
- RRD-6CL (RadioRA 2 dimmer)
- All ELV, MLV, and incandescent dimmers

**Dashboard Control:**
- ✅ Turn on/off
- ✅ Set brightness (0-100%)
- ✅ Fade rate (may vary by system)
- ❌ Advanced fade curves

**Example:**
```
Device: Living Room Lights
Type: Dimmer
Capabilities: switch, switchLevel
Commands: on, off, setLevel
Brightness Range: 0-100%
```

**Tip:** Some Lutron dimmers have minimum brightness levels set in the Lutron app. The dashboard respects these limits.

### Shades and Blinds

**Lutron Models:**
- Serena Wood Blinds
- Serena Honeycomb Shades
- Sivoia QS Shades (RadioRA 2/HomeWorks QS)
- Palladiom Shades

**Dashboard Control:**
- ✅ Open/close
- ✅ Set position (0-100%)
- ✅ Stop command
- ❌ Tilt control (some models)
- ❌ Scene positions (use Lutron app)

**Example:**
```
Device: Bedroom Shades
Type: Window Shade
Capabilities: windowShade, switchLevel
Commands: open, close, setPosition, stop
Position Range: 0% (closed) to 100% (open)
```

**Warning:** Stopping shades mid-movement may not be instant due to SmartThings-Lutron communication delay.

### Pico Remotes

Pico remotes appear as button controllers in SmartThings:

**Dashboard Capabilities:**
- ✅ Button press events (as triggers)
- ✅ Multi-button detection
- ❌ Programming buttons (use Lutron app)
- ❌ LED control

**Use Cases:**
- Create SmartThings automations triggered by Pico buttons
- Example: "When Pico button 2 pressed, turn on media lights"
- Pico buttons are numbered 1-4 (or 1-6 for larger models)

**Example Automation:**
```
Trigger: Pico Remote "Bedroom Pico" button 1 pressed
Action: Turn off all bedroom lights
```

### Occupancy Sensors

**Lutron Models:**
- LRF2-OCR2B (Caseta occupancy sensor)
- RadioRA 2 occupancy/vacancy sensors

**Dashboard Control:**
- ✅ Occupancy status (occupied/vacant)
- ✅ Status as trigger for automations
- ❌ Timeout adjustment (use Lutron app)
- ❌ Sensitivity settings (use Lutron app)

**Example:**
```
Device: Bathroom Sensor
Type: Motion Sensor
Capabilities: motionSensor
States: active, inactive
```

**Tip:** Use Lutron app to configure sensor timeout and sensitivity. SmartThings only sees the final occupied/vacant state.

## Multi-Location Setups

If you have multiple Lutron bridges or locations:

1. **Link Each Location:**
   - Repeat the SmartThings integration process for each Lutron location
   - Each bridge appears as a separate integration

2. **Room Naming:**
   - Use location prefixes to avoid confusion
   - Example: "Upstairs Living Room" vs "Basement Living Room"

3. **Dashboard Filtering:**
   - Use room filters to view devices by location
   - Create custom views for each area

## Integration Verification Checklist

After completing setup, verify your integration with these quick tests:

### Quick Test (5 minutes)

**Test 1: Device Discovery**
```bash
# MCP Tool: list_devices
# Expected: Lutron devices appear with label containing "Caseta" or manufacturer info
# Status: ✅ Pass if all Lutron devices listed
```

Verify that all your Lutron devices appear in the MCP dashboard device list with the correct platform tag (SmartThings/Lutron).

**Test 2: Switch Control**
```typescript
// MCP Tool: turn_on_device
{
  "deviceId": "[Your Lutron Switch ID]"
}
// Expected: Physical light turns on within 1-3 seconds
// Status: ✅ Pass if light responds
```

**Test 3: Dimmer Control**
```typescript
// MCP Tool: set_level
{
  "deviceId": "[Your Lutron Dimmer ID]",
  "level": 50
}
// Expected: Light dims to 50% brightness
// Status: ✅ Pass if brightness matches
```

**Test 4: Status Query**
```typescript
// MCP Tool: get_device_status
{
  "deviceId": "[Your Lutron Device ID]"
}
// Expected: Returns current on/off state and brightness level
// Status: ✅ Pass if status reflects physical device state
```

**Test 5: Room Filtering**
```typescript
// MCP Tool: list_devices_by_room
{
  "roomName": "Kitchen"
}
// Expected: All Lutron devices in Kitchen room appear
// Status: ✅ Pass if room filter works
```

### If Verification Fails

**If Test 1 Fails (Devices Not Listed):**
1. Check SmartThings app → Devices → Verify Lutron devices appear
2. If missing in SmartThings: Re-link Lutron integration (Step 2 of Setup)
3. If in SmartThings but not MCP: Restart MCP dashboard, refresh device cache

**If Test 2-4 Fail (Control Issues):**
1. Verify device online in Lutron app
2. Check SmartThings app can control device
3. If SmartThings works but MCP doesn't: Check MCP logs for API errors
4. Test direct SmartThings API access token validity

**If Test 5 Fails (Room Filtering):**
1. Verify room assignment in SmartThings app
2. Room names are case-sensitive in MCP
3. Re-assign room in SmartThings if needed

## Troubleshooting

### Issue: Lutron devices not appearing in SmartThings

**Possible Causes:**
- Lutron bridge offline
- Integration not authorized
- Network connectivity issues

**Solutions:**
1. **Check Lutron bridge status:**
   - Open Lutron app
   - Verify bridge shows as "Connected"
   - Check bridge status light (should be solid)

2. **Verify integration:**
   - SmartThings app → Menu → Linked Services
   - Ensure "Lutron" shows as connected
   - If not, re-authorize the integration

3. **Re-sync devices:**
   - In SmartThings app, go to Menu → Settings
   - Find "Lutron" under Linked Services
   - Tap "Discover devices" or "Sync"
   - Wait 1-2 minutes for discovery

4. **Check network:**
   - Ensure Lutron bridge and SmartThings hub are on same network
   - Check router firewall settings (allow local communication)
   - Restart both hubs if needed

### Issue: Lutron devices showing "Offline" or "Unavailable"

**Possible Causes:**
- Lutron bridge lost connection
- Device removed from Lutron app
- SmartThings-Lutron link broken

**Solutions:**
1. **Check individual device:**
   - Test device in Lutron app
   - If it works there, problem is with integration
   - If it doesn't work, check device power/pairing

2. **Refresh integration:**
   - SmartThings app → Device → tap device name
   - Pull down to refresh status
   - May take 10-15 seconds

3. **Re-authorize integration:**
   - Menu → Settings → Linked Services → Lutron
   - Tap "Reconnect" or "Authorize"
   - Sign in again with Lutron credentials

### Issue: Delayed response when controlling Lutron devices

**Expected Behavior:**
- Lutron devices via SmartThings have 1-3 second delay
- This is normal for cloud-based integration
- Direct Lutron app control is always faster

**Mitigation:**
- For time-critical automations, use Lutron app's native scenes
- For complex routines involving multiple platforms, accept the delay
- Pico remotes controlling Lutron devices directly (via Lutron programming) have no delay

### Issue: Dimmer brightness not matching between apps

**Possible Causes:**
- Minimum brightness set in Lutron app
- Rounding differences between systems
- Load type affecting actual brightness

**Solutions:**
1. **Check minimum brightness:**
   - Lutron app → Device Settings → Advanced
   - Note minimum brightness setting
   - SmartThings cannot go below this level

2. **Calibrate loads:**
   - Use Lutron app to calibrate dimmer to load type
   - This ensures accurate brightness levels
   - Recalibrate if you change bulbs

3. **Use percentage targets:**
   - Set specific percentages (e.g., 50%) rather than generic terms
   - Avoid "dim" or "brighten" commands if precision matters

### Issue: Shades not stopping at correct position

**Possible Causes:**
- Shades need calibration
- Position drift over time
- Mechanical obstruction

**Solutions:**
1. **Recalibrate shades:**
   - Lutron app → Shade Settings → Calibration
   - Follow calibration procedure
   - Test positions after calibration

2. **Set favorite positions:**
   - Use Lutron app to set favorite positions
   - Reference these in SmartThings automations
   - More reliable than specific percentages

3. **Check for obstructions:**
   - Ensure nothing blocking shade path
   - Clean shade tracks if needed
   - Contact Lutron support for mechanical issues

## Advanced Features

### Using Pico Remotes as Triggers

Create sophisticated automations using Pico buttons:

**Example 1: Multi-System Scene**
```
Trigger: Pico "Bedroom" button 1 pressed
Actions:
- Dim Lutron bedroom lights to 30%
- Turn off SmartThings ceiling fan
- Close Lutron blackout shades
- Set Philips Hue strip to red
```

**Example 2: Button Sequences**
```
Trigger: Pico "Living Room" button 2 double-pressed
Actions:
- If movie mode active: Turn all lights off
- If normal mode: Dim lights to 70%
```

**Setting Up:**
1. SmartThings app → Automations → "+"
2. Choose "If" → "Device status"
3. Select Pico remote → Choose button number
4. Add actions for any SmartThings-connected devices

### Occupancy-Based Automations

Combine Lutron sensors with multi-platform devices:

**Example: Bathroom Automation**
```
Trigger: Lutron occupancy sensor detects motion
Conditions: Time is between sunset and sunrise
Actions:
- Turn on Lutron bathroom lights to 60%
- Turn on SmartThings exhaust fan
- After 5 minutes of no motion: Turn off all
```

**Benefits:**
- Lutron sensors are highly reliable
- Fast local detection in Lutron system
- Can control devices from any platform via SmartThings

### Scheduling and Scenes

**Limitation:** You cannot create or edit Lutron scenes from SmartThings.

**Workaround:**
1. **Create scenes in Lutron app:**
   - Set up your desired lighting configuration
   - Save as a Lutron scene
   - Example: "Movie Time" - dims lights to 20%

2. **Trigger from SmartThings:**
   - While you can't execute Lutron scenes directly...
   - Create SmartThings routines that replicate the scene
   - Or use Pico remotes to trigger native Lutron scenes
   - Then use those Pico presses as SmartThings automation triggers

**Alternative:**
- Use SmartThings scenes that include Lutron devices
- Set individual device states in the scene
- Not as fast as native Lutron scenes, but more flexible

## Limitations

### What SmartThings Integration Cannot Do

1. **Native Lutron Features:**
   - Cannot create/edit Lutron scenes
   - Cannot program Pico remotes
   - Cannot adjust fade rates (uses Lutron defaults)
   - Cannot change sensor sensitivity/timeout
   - Cannot update Lutron firmware

2. **Advanced Programming:**
   - No access to Lutron timeclock events
   - Cannot use Lutron conditional programming
   - No access to Lutron astronomical clock
   - Cannot create complex button sequences

3. **Professional Features (RadioRA 2/HomeWorks QS):**
   - No keypad LED control
   - Cannot modify integration reports
   - No access to GRAFIK Eye scenes
   - Cannot program architectural dimmers

### Working Within Limitations

**Strategy 1: Hybrid Approach**
- Use Lutron app for lighting scenes and programming
- Use SmartThings for cross-platform automations
- Example: Lutron controls all lights natively, SmartThings adds smart locks and sensors

**Strategy 2: Pico Bridge**
- Program Pico remotes in Lutron app to control Lutron devices (fast, local)
- Use Pico button events in SmartThings to trigger other platforms (flexible)

**Strategy 3: Time-Based Division**
- Lutron handles scheduled lighting changes (reliable, local)
- SmartThings handles presence-based automations (cloud, flexible)

## System Comparison

### Caseta vs RadioRA 2 vs HomeWorks QS

| Feature | Caseta | RadioRA 2 | HomeWorks QS |
|---------|--------|-----------|--------------|
| **SmartThings Integration** | ✅ Native | ✅ Native | ⚠️ Professional |
| **Max Devices** | 50 | 200 | 10,000+ |
| **Geofencing** | Via SmartThings | Via SmartThings | Via SmartThings |
| **Local Control** | Lutron app | Lutron app | Lutron app |
| **Scene Control** | Lutron app only | Lutron app only | Lutron app only |
| **Price Point** | Consumer | Prosumer | Commercial |
| **DIY Install** | ✅ Yes | ⚠️ Advanced DIY | ❌ Professional only |
| **Dashboard Compatibility** | ✅ Full | ✅ Full | ✅ Full |

**Recommendation:**
- **Caseta:** Best for most homes, easy DIY setup, great SmartThings integration
- **RadioRA 2:** For larger homes or when you need 50+ devices
- **HomeWorks QS:** Commercial/luxury installations only

## Best Practices

### 1. Consistent Naming

Use the same device names in both apps:
- ✅ "Kitchen Island Lights" (both apps)
- ❌ "Kitchen Island" (Lutron) vs "Island Pendant" (SmartThings)

**Why:** Easier voice control and reduces confusion

### 2. Room Organization

Mirror your Lutron room structure in SmartThings:
- Keep room names identical
- Assign devices to rooms in both apps
- Makes filtering and automation easier

### 3. Leverage Lutron's Speed

For instant response:
- Use Lutron app for scenes that only affect Lutron devices
- Use Pico remotes programmed in Lutron app for instant control
- Save SmartThings automations for cross-platform scenarios

### 4. Test Before Deploying

Before creating complex automations:
1. Verify basic on/off control works
2. Test dimming/position control
3. Check status reporting accuracy
4. Measure typical response times
5. Then build automations

### 5. Document Your Setup

Keep notes on:
- Which Lutron scenes do what
- Pico remote button assignments
- SmartThings automations involving Lutron devices
- Integration re-authorization date

## Supported Lutron Devices & Capabilities

### Device Capability Matrix

| Lutron Device | SmartThings Capability | MCP DeviceCapability | Supported Commands | Limitations |
|---------------|------------------------|----------------------|-------------------|-------------|
| **Caseta Dimmer (PD-6WCL)** | `switch`, `switchLevel` | `SWITCH`, `DIMMER` | `on`, `off`, `setLevel(0-100)` | Min brightness set in Lutron app |
| **Caseta Switch (PD-5WS)** | `switch` | `SWITCH` | `on`, `off` | No dimming |
| **Serena Shade** | `windowShade`, `switchLevel` | `SHADE` | `open`, `close`, `setPosition(0-100)`, `stop` | Position may drift, recalibrate periodically |
| **Pico Remote** | `button` | `BUTTON` (event-based) | Button press events (1-6) | Not controllable, trigger-only |
| **Occupancy Sensor** | `motionSensor` | `MOTION_SENSOR` | State: `active`, `inactive` | Timeout configured in Lutron app |
| **RadioRA 2 Dimmer** | `switch`, `switchLevel` | `SWITCH`, `DIMMER` | Same as Caseta | More zones supported |
| **Sivoia QS Shade** | `windowShade`, `switchLevel` | `SHADE` | Same as Serena + tilt (some models) | Professional calibration recommended |

### Capability Mapping

MCP translates Lutron capabilities through the SmartThings integration to unified `DeviceCapability` enum:

| Lutron Device | ST Capability | MCP DeviceCapability | Commands |
|---------------|---------------|----------------------|----------|
| Caseta Switch | `switch` | `SWITCH` | `on`, `off` |
| Caseta Dimmer | `switch`, `switchLevel` | `SWITCH`, `DIMMER` | `on`, `off`, `setLevel(0-100)` |
| Serena Shade | `windowShade`, `switchLevel` | `SHADE` | `open`, `close`, `setPosition(0-100)`, `stop` |
| Occupancy Sensor | `motionSensor` | `MOTION_SENSOR` | Read-only: `active`, `inactive` |

### Unsupported Features

| Feature | Why Not Supported | Workaround |
|---------|-------------------|------------|
| **Lutron Scenes** | SmartThings cannot import native Lutron scenes | Create equivalent SmartThings scenes |
| **Pico Programming** | Pico buttons are configured in Lutron app only | Use Pico events as SmartThings automation triggers |
| **Fade Rates** | SmartThings uses default Lutron fade rates | Configure preferred fade rate in Lutron app (applies universally) |
| **Sensor Sensitivity** | SmartThings receives final occupancy state only | Adjust sensitivity in Lutron app settings |
| **Timeclock Events** | Lutron timeclock is independent of SmartThings | Use SmartThings Rules for scheduling |

### Platform Comparison: Coverage

| Platform | % Capability Coverage | Notes |
|----------|----------------------|-------|
| **SmartThings** | 100% | Full device control via official integration |
| **Tuya** | N/A | No Lutron integration |
| **Lutron (Direct)** | 100% | Via LEAP protocol (not implemented in MCP) |

**Note:** MCP SmartThings provides 100% coverage of Lutron device control capabilities available through the SmartThings integration.

## Getting Help

### Official Resources

- **Lutron Support:** https://www.lutron.com/support
- **Lutron Pro Portal:** https://www.lutron.com/en-US/pages/SupportCenter/
- **SmartThings Community:** https://community.smartthings.com/
- **SmartThings Support:** https://support.smartthings.com/

### Common Questions

**Q: Can I use Lutron without SmartThings hub?**
A: Yes, Lutron works standalone. SmartThings is only needed for cross-platform integration.

**Q: Will my Lutron devices stop working if SmartThings is down?**
A: No. Lutron devices always work via the Lutron app and physical controls. SmartThings integration is additional functionality.

**Q: Can I control Lutron devices with Alexa/Google Assistant through SmartThings?**
A: Yes. Once integrated with SmartThings, you can control Lutron via any SmartThings-compatible voice assistant.

**Q: Do I need the Lutron Smart Bridge Pro or is the regular Smart Bridge enough?**
A: Regular Smart Bridge works fine for SmartThings integration. Smart Bridge Pro adds Apple HomeKit support.

**Q: How often does status sync between Lutron and SmartThings?**
A: Status updates are near real-time (1-3 seconds). Manual changes in Lutron app are reflected in SmartThings quickly.

## Next Steps

After completing setup:

1. ✅ Test all Lutron devices in dashboard
2. ✅ Verify room assignments
3. ✅ Create cross-platform automations if desired
4. ✅ Set up voice control through SmartThings integration
5. ✅ Explore Pico remote automation triggers

**Related Guides:**
- [Brilliant Setup Guide](BRILLIANT-SETUP.md)
- [SmartThings OAuth Setup](SMARTAPP_SETUP.md)
- [Installation Guide](installation-guide.md)

---

**Last Updated:** 2025-12-02
**Integration Version:** SmartThings API v1.0
**Supported Lutron Systems:** Caseta, RadioRA 2, HomeWorks QS
