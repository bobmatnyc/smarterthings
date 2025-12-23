/**
 * Debug Layout Rendering on /auth Page
 *
 * This script analyzes what components are rendered when visiting /auth
 * to identify which component is making the 401 API call that triggers the redirect loop.
 */

console.log('=== DEBUG: Layout Rendering Analysis ===\n');

console.log('When user visits http://localhost:5181/auth:\n');

console.log('1. +layout.svelte onMount (lines 73-114):');
console.log('   - Checks: $page.url.pathname.startsWith(\'/auth\')');
console.log('   - Result: TRUE ✅');
console.log('   - Action: Sets authChecked=true, returns early');
console.log('   - Status: isAuthenticated=false, authChecked=true\n');

console.log('2. +layout.svelte render condition (line 141):');
console.log('   {:else if isAuthenticated || $page.url.pathname.startsWith(\'/auth\')}');
console.log('   - isAuthenticated: false');
console.log('   - $page.url.pathname.startsWith(\'/auth\'): TRUE');
console.log('   - Result: TRUE (renders full app shell) ✅\n');

console.log('3. Components rendered on /auth page:');
console.log('   - <ChatSidebar /> (line 145)');
console.log('   - <Header /> (line 174)');
console.log('   - <SubNav /> (line 177)');
console.log('   - <main>{@render children()}</main> (line 180-182)');
console.log('     └─ renders /auth/+page.svelte → <OAuthConnect />\n');

console.log('4. Problem Identification:');
console.log('   ❌ LAYOUT RENDERS FULL APP SHELL ON AUTH PAGE');
console.log('   ❌ This means Header, SubNav, ChatSidebar are ALL rendered');
console.log('   ❌ If ANY of these make API calls on mount → 401 → redirect loop\n');

console.log('5. Likely Culprits:');
console.log('   - Header: May fetch user info, notifications, etc.');
console.log('   - SubNav: May fetch navigation data');
console.log('   - ChatSidebar/chatStore: May initialize with API call');
console.log('   - Even {children()} might trigger something\n');

console.log('6. The Fix:');
console.log('   The /auth page should render ONLY the auth UI, NOT the app shell.');
console.log('   Line 141 should be:');
console.log('   {:else if isAuthenticated}  // Remove the || $page.url check');
console.log('   ');
console.log('   Then add a separate block for /auth:');
console.log('   {:else if $page.url.pathname.startsWith(\'/auth\')}');
console.log('     <!-- Render ONLY auth page content, no app shell -->');
console.log('     <main>{@render children()}</main>');
console.log('   {/if}\n');

console.log('=== END DEBUG ===');
