<?php
/**
 * VERSACE22 ENQUEUE BRIDGE - INTEGRATED VERSION
 * Bidirectional integration with ai-chat-persona-pro
 */
// Global plugin registry for bidirectional communication
global $versace22_registered_plugins;
if (!is_array($versace22_registered_plugins)) {
    $versace22_registered_plugins = [];
}
global $versace22_endpoint_manifest;
if (!is_array($versace22_endpoint_manifest)) {
    $versace22_endpoint_manifest = [];
}
if (!function_exists('versace22_register_plugin')) {
    function versace22_register_plugin($plugin_id, $file_path, $version) {
        global $versace22_registered_plugins;
        $versace22_registered_plugins[$plugin_id] = ['file' => $file_path, 'version' => $version, 'registered_at' => time()];
    }
}
if (!function_exists('versace22_register_endpoints')) {
    function versace22_register_endpoints($manifest) {
        global $versace22_endpoint_manifest;
        $versace22_endpoint_manifest = array_merge($versace22_endpoint_manifest, $manifest);
    }
}
if (!function_exists('versace22_get_registered_plugins')) {
    function versace22_get_registered_plugins() {
        global $versace22_registered_plugins;
        return $versace22_registered_plugins;
    }
}
if (!function_exists('versace22_get_endpoint_manifest')) {
    function versace22_get_endpoint_manifest() {
        global $versace22_endpoint_manifest;
        return $versace22_endpoint_manifest;
    }
}

/**
 * Dynamically discover and register endpoints from ai-chat-persona-pro
 */
function versace22_enqueue_discover_endpoints() {
    if (!class_exists('AI_Chat_Persona_Pro_Ultimate')) {
        return;
    }
    $instance = AI_Chat_Persona_Pro_Ultimate::get_instance();
    if (!$instance) {
        return;
    }
    $endpoints = array();
    if (method_exists($instance, 'get_registered_endpoints')) {
        $endpoints = $instance->get_registered_endpoints();
    }
    $filtered_endpoints = apply_filters('ai_chat_persona_pro_endpoints', array());
    if (!empty($filtered_endpoints)) {
        $endpoints = array_merge($endpoints, $filtered_endpoints);
    }
    $option_endpoints = get_option('ai_chat_persona_pro_endpoints', array());
    if (!empty($option_endpoints)) {
        $endpoints = array_merge($endpoints, $option_endpoints);
    }
    if (!empty($endpoints)) {
        add_filter('versace22_enqueue_manifest', function($manifest) use ($endpoints) {
            if (!isset($manifest['ai-chat-persona-pro'])) {
                $manifest['ai-chat-persona-pro'] = array();
            }
            foreach ($endpoints as $endpoint_id => $endpoint_config) {
                if (!isset($manifest['ai-chat-persona-pro'][$endpoint_id])) {
                    $manifest['ai-chat-persona-pro'][$endpoint_id] = $endpoint_config;
                }
            }
            return $manifest;
        });
    }
}
add_action('init', 'versace22_enqueue_discover_endpoints', 20);

if (!defined('VERSACE22_ENQUEUE_MIN_AI_CHAT_VERSION')) {
    define('VERSACE22_ENQUEUE_MIN_AI_CHAT_VERSION', '1.0.0');
}
// AI Chat Persona Pro version compatibility ceiling
// Updated to v12.3 to match current plugin release
if (!defined('VERSACE22_ENQUEUE_MAX_AI_CHAT_VERSION')) {
    define('VERSACE22_ENQUEUE_MAX_AI_CHAT_VERSION', '12.5');
}
function versace22_enqueue_check_compatibility() {
    if (!defined('AI_CHAT_PERSONA_PRO_VERSION')) {
        return true;
    }
    $ai_chat_version = AI_CHAT_PERSONA_PRO_VERSION;
    $min_version = VERSACE22_ENQUEUE_MIN_AI_CHAT_VERSION;
    $max_version = VERSACE22_ENQUEUE_MAX_AI_CHAT_VERSION;
    if (version_compare($ai_chat_version, $min_version, '<')) {
        add_action('admin_notices', function() use ($ai_chat_version, $min_version) {
            echo '<div class="notice notice-error"><p><strong>Versace22 Enqueue:</strong> AI Chat Persona Pro version '. esc_html($ai_chat_version). ' is too old. Minimum required version is '. esc_html($min_version). '. Please update AI Chat Persona Pro to ensure compatibility.</p></div>';
        });
        return false;
    }
    if (version_compare($ai_chat_version, $max_version, '>')) {
        add_action('admin_notices', function() use ($ai_chat_version, $max_version) {
            echo '<div class="notice notice-warning"><p><strong>Versace22 Enqueue:</strong> AI Chat Persona Pro version '. esc_html($ai_chat_version). ' is newer than tested. Maximum tested version is '. esc_html($max_version). '. Some features may not work correctly. Please update Versace22 Enqueue.</p></div>';
        });
        if (function_exists('error_log')) {
            error_log('[Versace22 Enqueue] Warning: AI Chat Persona Pro version '. $ai_chat_version. ' exceeds tested version '. $max_version);
        }
    }
    return true;
}
add_action('admin_init', 'versace22_enqueue_check_compatibility');
/**
 * versace22-enqueue.php
 * Frontend bridge for AI Chat Persona Pro (v12.4) ↔ VERSACE22 React UI.
 *
 * v12 — "Total handshake" upgrade on top of v11:
 *   • Full action manifest — every aicpp_* endpoint the plugin exposes is
 *     advertised to the UI under `window.versace22_chat.endpoints` with its
 *     correct nonce group, capability requirement, and `nopriv` flag.
 *     The UI no longer has to hard-code action names or guess nonces.
 *   • Per-feature nonce bundle — chat/admin/login/register/upload/voice/
 *     project/persona/memory/artifact/referral/profile nonces are issued
 *     only when the current user is actually allowed to use them.
 *   • REST namespace + admin-ajax base — both transports advertised.
 *   • Capability flags map — `can.upload`, `can.voice`, `can.admin`,
 *     `can.create_project`, etc. — so the UI can disable controls
 *     deterministically instead of probing endpoints.
 *   • Plugin / bundle / bridge versions for diagnostics.
 *   • All v11 hardening preserved: trusted client-IP, single shortcode
 *     owner @ init:99, SRI sha384, capability-gated key omission.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ---------- Safety: only act on real frontend page requests ---------- */
if (!function_exists('versace22_is_safe_frontend_request')) {
    function versace22_is_safe_frontend_request() {
        if (is_admin()) return false;
        if ((defined('REST_REQUEST') && REST_REQUEST)
            || (defined('DOING_AJAX') && DOING_AJAX)
            || (defined('DOING_CRON') && DOING_CRON)) {
            return false;
        }
        return true;
    }
}

/* ---------- Trusted client IP (anti-spoofing) — unchanged from v11 ---------- */
if (!function_exists('versace22_cidr_match')) {
    function versace22_cidr_match($ip, $cidr) {
        if (strpos($cidr, '/') === false) return $ip === $cidr;
        list($subnet, $bits) = explode('/', $cidr, 2);
        $bits = (int) $bits;
        $ip_bin     = @inet_pton($ip);
        $subnet_bin = @inet_pton($subnet);
        if ($ip_bin === false || $subnet_bin === false) return false;
        if (strlen($ip_bin) !== strlen($subnet_bin))    return false;
        $bytes = intdiv($bits, 8);
        $rem   = $bits % 8;
        if ($bytes > 0 && substr($ip_bin, 0, $bytes) !== substr($subnet_bin, 0, $bytes)) return false;
        if ($rem === 0) return true;
        $mask = chr((0xff << (8 - $rem)) & 0xff);
        return (substr($ip_bin, $bytes, 1) & $mask) === (substr($subnet_bin, $bytes, 1) & $mask);
    }
}

if (!function_exists('versace22_get_client_ip')) {
    function versace22_get_client_ip() {
        $remote = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
        $trusted = apply_filters('versace22_trusted_proxies', array(
            '173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22',
            '141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20',
            '197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13',
            '104.24.0.0/14','172.64.0.0/13','131.0.72.0/22',
            '2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32',
            '2405:8100::/32','2a06:98c0::/29','2c0f:f248::/32',
        ));
        $is_trusted = false;
        foreach ($trusted as $cidr) {
            if (versace22_cidr_match($remote, $cidr)) { $is_trusted = true; break; }
        }
        if (!$is_trusted) return $remote;
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $cf = trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
            if (filter_var($cf, FILTER_VALIDATE_IP) !== false) return $cf;
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            foreach (explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']) as $candidate) {
                $candidate = trim($candidate);
                $valid = filter_var($candidate, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
                if ($valid !== false) return $candidate;
            }
        }
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $real = trim((string) $_SERVER['HTTP_X_REAL_IP']);
            if (filter_var($real, FILTER_VALIDATE_IP) !== false) return $real;
        }
        return $remote;
    }
}

/* ---------- Bundle auto-detect — unchanged from v11 ---------- */
if (!function_exists('versace22_find_asset_file')) {
    function versace22_find_asset_file($extension, $preferred = array()) {
        $extension = ltrim((string) $extension, '.');
        $dir = plugin_dir_path(__FILE__);
        foreach ($preferred as $candidate) {
            $candidate = (string) $candidate;
            if ($candidate !== '' && file_exists($dir . $candidate)) return $candidate;
        }
        $matches = glob($dir . 'index*.' . $extension);
        if (!empty($matches)) {
            usort($matches, function ($a, $b) { return filemtime($b) <=> filemtime($a); });
            return basename($matches[0]);
        }
        $matches = glob($dir . '*.' . $extension);
        if (!empty($matches)) {
            usort($matches, function ($a, $b) { return filemtime($b) <=> filemtime($a); });
            return basename($matches[0]);
        }
        return '';
    }
}

/* ---------- SRI — unchanged from v11 ---------- */
if (!function_exists('versace22_sri_hash')) {
    function versace22_sri_hash($abs_path) {
        if (!is_string($abs_path) || $abs_path === '' || !file_exists($abs_path)) return '';
        $digest = @hash_file('sha384', $abs_path, true);
        if ($digest === false) return '';
        return 'sha384-' . base64_encode($digest);
    }
}
if (!function_exists('versace22_register_sri')) {
    function versace22_register_sri($handle = null, $hash = null) {
        static $map = array();
        if ($handle !== null && $hash !== null && $hash !== '') $map[(string) $handle] = (string) $hash;
        return $map;
    }
}
if (!function_exists('versace22_inject_script_sri')) {
    function versace22_inject_script_sri($tag, $handle, $src) {
        $map = versace22_register_sri();
        if (!isset($map[$handle]) || strpos($tag, 'integrity=') !== false) return $tag;
        $attrs = ' integrity="' . esc_attr($map[$handle]) . '" crossorigin="anonymous"';
        return preg_replace('/<script\b/', '<script' . $attrs, $tag, 1);
    }
    add_filter('script_loader_tag', 'versace22_inject_script_sri', 10, 3);
}
if (!function_exists('versace22_inject_style_sri')) {
    function versace22_inject_style_sri($tag, $handle) {
        $map = versace22_register_sri();
        if (!isset($map[$handle]) || strpos($tag, 'integrity=') !== false) return $tag;
        $attrs = ' integrity="' . esc_attr($map[$handle]) . '" crossorigin="anonymous"';
        return preg_replace('/<link\b/', '<link' . $attrs, $tag, 1);
    }
    add_filter('style_loader_tag', 'versace22_inject_style_sri', 10, 2);
}

/* ---------- Shortcode-active flag + admin-bar hide — unchanged ---------- */
if (!function_exists('versace22_chat_is_active')) {
    function versace22_chat_is_active($set = null) {
        static $active = false;
        if ($set !== null) $active = (bool) $set;
        return $active;
    }
}
if (!function_exists('versace22_maybe_hide_admin_bar')) {
    function versace22_maybe_hide_admin_bar() {
        if (versace22_chat_is_active()) show_admin_bar(false);
    }
    add_action('wp', 'versace22_maybe_hide_admin_bar', 100);
}

/* ---------- Google OAuth resolver — unchanged ---------- */
if (!function_exists('versace22_resolve_google_login_url')) {
    function versace22_resolve_google_login_url() {
        if (function_exists('NextendSocialLogin') || class_exists('NextendSocialLogin')) {
            return esc_url_raw(home_url('/wp-login.php?loginSocial=google'));
        }
        $custom = apply_filters('versace22_google_login_url', '');
        if (is_string($custom) && $custom !== '') return esc_url_raw($custom);
        return '';
    }
}

/* ---------- NEW v12: Endpoint manifest ----------
 * Single source of truth for every aicpp_* AJAX action the plugin exposes.
 * Each entry: action, nonce group, capability, nopriv allowed.
 * The UI consumes window.versace22_chat.endpoints[<key>] and never has to
 * guess action names, nonce groups, or capability rules.
 */
if (!function_exists('versace22_endpoint_manifest')) {
    function versace22_endpoint_manifest() {
        // group => list of [key, action, nonce, cap, nopriv]
        return array(
            'chat' => array(
                array('chat',                'aicpp_chat',                'aicpp_chat',  'read',           true),
                array('chat_main',           'aicpp_chat_main',           'aicpp_chat',  'read',           true),
                array('transcribe_audio',    'aicpp_transcribe_audio',    'aicpp_chat',  'read',           true),
                array('upload_file',         'aicpp_upload_file',         'aicpp_chat',  'read',           true),
                array('speak',               'aicpp_speak',               'aicpp_chat',  'read',           false),
                array('search_messages',     'aicpp_search_messages',     'aicpp_chat',  'read',           false),
            ),
            'conversations' => array(
                array('list',                'aicpp_get_conversations',   'aicpp_chat',  'read',           true),
                array('load',                'aicpp_load_conversation',   'aicpp_chat',  'read',           true),
                array('delete',              'aicpp_delete_conversation', 'aicpp_chat',  'read',           true),
                array('pin',                 'aicpp_pin_conversation',    'aicpp_chat',  'read',           false),
                array('assign_to_project',   'aicpp_assign_conversation_project', 'aicpp_chat', 'read',    false),
            ),
            'personas' => array(
                array('mine',                'aicpp_get_my_personas',     'aicpp_chat',  'read',           true),
                array('get',                 'aicpp_get_persona',         'aicpp',       'manage_options', false),
                array('save',                'aicpp_save_persona',        'aicpp',       'manage_options', false),
                array('delete',              'aicpp_delete_persona',      'aicpp',       'manage_options', false),
                array('assign',              'aicpp_assign_persona',      'aicpp',       'manage_options', false),
                array('unassign',            'aicpp_unassign_persona',    'aicpp',       'manage_options', false),
                array('bulk_assign',         'aicpp_bulk_assign',         'aicpp',       'manage_options', false),
                array('user_personas',       'aicpp_get_user_personas',   'aicpp',       'manage_options', false),
                array('persona_users',       'aicpp_get_persona_users',   'aicpp',       'manage_options', false),
                array('search_users',        'aicpp_search_users',        'aicpp',       'manage_options', false),
            ),
            'projects' => array(
                array('list',                'aicpp_get_projects',        'aicpp',  'manage_options', false),
                array('create',              'aicpp_create_project',      'aicpp',  'manage_options', false),
                array('update',              'aicpp_update_project',      'aicpp',  'manage_options', false),
                array('delete',              'aicpp_delete_project',      'aicpp',  'manage_options', false),
                array('attach_file',         'aicpp_attach_project_file', 'aicpp',  'manage_options', false),
                array('detach_file',         'aicpp_detach_project_file', 'aicpp',  'manage_options', false),
            ),
            'memories' => array(
                array('list',                'aicpp_get_memories',        'aicpp',  'manage_options', false),
                array('add',                 'aicpp_add_memory',          'aicpp',  'manage_options', false),
                array('update',              'aicpp_update_memory',       'aicpp',  'manage_options', false),
                array('delete',              'aicpp_delete_memory',       'aicpp',  'manage_options', false),
                array('toggle',              'aicpp_toggle_memory',       'aicpp',  'manage_options', false),
            ),
            'artifacts' => array(
                array('list',                'aicpp_list_artifacts',      'aicpp_chat',  'read',           false),
                array('get',                 'aicpp_get_artifact',        'aicpp_chat',  'read',           false),
                array('save',                'aicpp_save_artifact',       'aicpp_chat',  'read',           false),
                array('delete',              'aicpp_delete_artifact',     'aicpp_chat',  'read',           false),
            ),
            'rewards' => array(
                array('referrals',           'aicpp_get_referral_data',   'aicpp_chat',  'read',           false),
                array('leaderboard',         'aicpp_get_leaderboard',     'aicpp_chat',  'read',           false),
            ),
            'account' => array(
                array('update_profile',      'aicpp_update_profile',      'aicpp_chat',  'read',           false),
                array('login',               'aicpp_login_user',          'aicpp_login', '',               true),
                array('register',            'aicpp_register_user',       'aicpp_register','',             true),
            ),
            'data_sources' => array(
                array('list',                'aicpp_ds_list',              'aicpp_chat',  'read',           false),
                array('connect',             'aicpp_ds_connect',           'aicpp_chat',  'read',           false),
                array('disconnect',          'aicpp_ds_disconnect',        'aicpp_chat',  'read',           false),
                array('test',                'aicpp_ds_test',              'aicpp_chat',  'read',           false),
            ),
            'engine' => array(
                array('rate',                'aicpp_engine_rate',          'aicpp_chat',  'read',           true),
            ),
            'models' => array(
                array('free_models',         'aicpp_or_free_models',      'aicpp',  'manage_options', false),
                array('refresh_free',        'aicpp_or_refresh_free',     'aicpp',  'manage_options', false),
            ),
        );
    }
}

/* ---------- NEW v12: Build per-capability endpoints view ---------- */
if (!function_exists('versace22_build_endpoints_for_user')) {
    function versace22_build_endpoints_for_user($is_logged_in, $is_admin) {
        $manifest = versace22_endpoint_manifest();
        $out = array();
        $nonces_needed = array();
        foreach ($manifest as $group => $rows) {
            $bucket = array();
            foreach ($rows as $row) {
                list($key, $action, $nonce_group, $cap, $nopriv) = $row;

                // Capability filter
                if ($cap === 'manage_options' && !$is_admin) continue;
                if ($cap === 'read' && !$is_logged_in && !$nopriv) continue;
                // 'read' + logged-in OR nopriv-allowed → expose
                // login/register ('') only when logged out
                if ($cap === '' && $is_logged_in
                    && in_array($action, array('aicpp_login_user', 'aicpp_register_user'), true)) continue;

                $bucket[$key] = array(
                    'action' => $action,
                    'nonce'  => $nonce_group,
                    'nopriv' => (bool) $nopriv,
                );
                $nonces_needed[$nonce_group] = true;
            }
            if (!empty($bucket)) $out[$group] = $bucket;
        }
        return array($out, array_keys($nonces_needed));
    }
}

/* ---------- Main renderer ---------- */
if (!function_exists('versace22_render_app')) {
    function versace22_render_app($args = array()) {
        if (!versace22_is_safe_frontend_request()) return '';

        // VERSACE22 INTEGRATION: Accept plugin context for 100% integration
        $plugin_id       = $args['plugin']   ?? '';
        $plugin_version  = $args['version']  ?? '';
        $plugin_instance = $args['instance'] ?? null;
        // Verify the calling plugin is registered for full integration mode
        global $versace22_registered_plugins;
        // Self-detect plugin context from the registry when caller didn't pass it
        if (empty($plugin_id) && is_array($versace22_registered_plugins) && !empty($versace22_registered_plugins)) {
            $plugin_id = array_key_first($versace22_registered_plugins);
        }
        $integration_mode = 'standalone';
        if (!empty($plugin_id) && isset($versace22_registered_plugins[$plugin_id])) {
            $integration_mode = 'full';
            $plugin_data = $versace22_registered_plugins[$plugin_id];
            if (empty($plugin_version) && isset($plugin_data['version'])) {
                $plugin_version = $plugin_data['version'];
            }
        }

        // Args
        $persona_id = 1;
        if (isset($args['personaId']) && is_numeric($args['personaId'])) $persona_id = (int) $args['personaId'];
        elseif (isset($args['persona_id']) && is_numeric($args['persona_id'])) $persona_id = (int) $args['persona_id'];

        $fullscreen = true;
        if (isset($args['fullscreen'])) {
            $v = strtolower(trim((string) $args['fullscreen']));
            $fullscreen = !in_array($v, array('0', 'false', 'no', 'off'), true);
        }
        $requested_height = isset($args['height']) ? (string) $args['height'] : '700px';
        $show_history = !isset($args['show_history']) || filter_var($args['show_history'], FILTER_VALIDATE_BOOLEAN);
        $allow_upload = !isset($args['allow_upload']) || filter_var($args['allow_upload'], FILTER_VALIDATE_BOOLEAN);
        $allow_voice  = !isset($args['allow_voice'])  || filter_var($args['allow_voice'],  FILTER_VALIDATE_BOOLEAN);

        // Default persona fallback
        global $wpdb;
        $table_personas = $wpdb->prefix . 'aicpp_personas';
        if ($persona_id <= 1) {
            $row = $wpdb->get_row("SELECT id FROM {$table_personas} WHERE is_default=1 LIMIT 1");
            if ($row && (int) $row->id > 0) $persona_id = (int) $row->id;
        }

        // Resolve bundle
        $plugin_url = plugin_dir_url(__FILE__);
        $plugin_dir = plugin_dir_path(__FILE__);
        $js_file  = versace22_find_asset_file('js',  array('index.js', 'index-7.js', 'index-6.js', 'index-5.js', 'index-4.js', 'assets/index.js'));
        $css_file = versace22_find_asset_file('css', array('index.css', 'index-7.css', 'index-6.css', 'index-5.css', 'index-4.css', 'assets/index.css'));
        if ($js_file === '') {
            return '<div style="padding:16px;border:1px solid #dc2626;background:#fff;color:#111">'
                 . esc_html__('AI chat bundle not found. Upload index.js into the plugin folder.', 'aicpp')
                 . '</div>';
        }

        // Enqueue CSS + SRI
        if ($css_file !== '') {
            $css_path = $plugin_dir . $css_file;
            wp_enqueue_style('aicpp-react-css', $plugin_url . $css_file, array(),
                file_exists($css_path) ? (string) filemtime($css_path) : '1.0');
            $h = versace22_sri_hash($css_path);
            if ($h !== '') versace22_register_sri('aicpp-react-css', $h);
        }
        // Enqueue JS + SRI
        $js_path = $plugin_dir . $js_file;
        wp_enqueue_script('aicpp-react-js', $plugin_url . $js_file, array(),
            file_exists($js_path) ? (string) filemtime($js_path) : '1.0', true);
        $h = versace22_sri_hash($js_path);
        if ($h !== '') versace22_register_sri('aicpp-react-js', $h);

        // Identity
        $is_logged_in = is_user_logged_in();
        $user         = $is_logged_in ? wp_get_current_user() : null;
        $is_admin     = $is_logged_in ? current_user_can('manage_options') : false;
        $session_id   = 'sess_' . wp_generate_uuid4();

        // Endpoint manifest + nonces actually needed
        list($endpoints, $nonce_groups) = versace22_build_endpoints_for_user($is_logged_in, $is_admin);
        $nonces = array();
        foreach ($nonce_groups as $g) $nonces[$g] = wp_create_nonce($g);

        // Capability flags the UI uses to enable/disable controls
        $can = array(
            'chat'           => true,
            'upload'         => (bool) $allow_upload,
            'voice'          => (bool) $allow_voice,
            'history'        => (bool) $show_history,
            'admin'          => (bool) $is_admin,
            'create_project' => (bool) $is_logged_in,
            'memories'       => (bool) $is_logged_in,
            'artifacts'      => (bool) $is_logged_in,
            'referrals'      => (bool) $is_logged_in,
            'leaderboard'    => (bool) $is_logged_in,
            'login'          => !$is_logged_in,
            'register'       => !$is_logged_in,
        );

        // Handshake
        $handshake = array(
            // Transport
            'ajaxurl'           => admin_url('admin-ajax.php'),
            'rest_url'          => '',
            'transport'         => 'admin-ajax',

            // VERSACE22 INTEGRATION: Plugin context and endpoint manifest
            'plugin_id'         => $plugin_id,
            'plugin_version'    => $plugin_version,
            'integration_mode'  => $integration_mode,
            'bridge_version'    => 'v12',
            'endpoint_manifest' => versace22_get_endpoint_manifest(),

            // Back-compat single-nonce field (chat)
            'nonce'             => isset($nonces['aicpp_chat']) ? $nonces['aicpp_chat'] : '',

            // NEW v12: full nonce bundle + endpoint manifest + capability flags
            'nonces'            => $nonces,
            'endpoints'         => $endpoints,
            'can'               => $can,

            // Session / persona
            'persona_id'        => (string) $persona_id,
            'session_id'        => $session_id,

            // Identity
            'user_logged_in'    => (bool) $is_logged_in,
            'user_id'           => $is_logged_in ? (int) $user->ID : 0,
            'is_admin'          => (bool) $is_admin,
            'user_display_name' => $is_logged_in ? $user->display_name : 'Guest',
            'user_email'        => $is_logged_in ? $user->user_email   : '',
            'user_avatar'       => $is_logged_in ? get_avatar_url($user->ID) : '',

            // Auth URLs
            'logout_url'        => wp_logout_url(home_url()),
            'login_url'         => wp_login_url(home_url()),
            'lostpassword_url'  => wp_lostpassword_url(home_url()),
            'register_url'      => wp_registration_url(),
            'google_login_url'  => versace22_resolve_google_login_url(),

            // Shortcode flags (back-compat duplicates of `can.*`)
            'show_history'      => (bool) $show_history,
            'allow_upload'      => (bool) $allow_upload,
            'allow_voice'       => (bool) $allow_voice,
            'fullscreen'        => (bool) $fullscreen,

            // Diagnostics
        );

        // Capability-gated legacy nonce keys (back-compat with v10/v11 UI)
        if ($is_admin)        $handshake['admin_nonce']    = isset($nonces['aicpp']) ? $nonces['aicpp'] : wp_create_nonce('aicpp');
        if (!$is_logged_in) {
            $handshake['login_nonce']    = isset($nonces['aicpp_login'])    ? $nonces['aicpp_login']    : wp_create_nonce('aicpp_login');
            $handshake['register_nonce'] = isset($nonces['aicpp_register']) ? $nonces['aicpp_register'] : wp_create_nonce('aicpp_register');
        }

        wp_localize_script('aicpp-react-js', 'versace22_chat', $handshake);
        // Alias so React builds that read window.aicppChat (the GitHub interface) boot correctly.
        wp_add_inline_script('aicpp-react-js', 'window.aicppChat = window.versace22_chat;', 'after');
        versace22_chat_is_active(true);

        $wrapper_id  = 'versace22-chat-wrapper';
        $root_id     = 'versace22-chat-root';
        $safe_height = esc_attr($requested_height !== '' ? $requested_height : '700px');

        if ($fullscreen) {
            $inline_css = '<style id="versace22-chat-inline-css">'
                . 'html,body{margin:0!important;padding:0!important;min-height:100%!important;height:100%!important;overflow:hidden!important;}'
                . 'html{margin-top:0!important;}#wpadminbar{display:none!important;}'
                . 'body > *:not(#' . $wrapper_id . '):not(script):not(style):not(link):not(noscript){display:none!important;}'
                . '#' . $wrapper_id . '{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:0!important;'
                . 'width:100vw!important;width:100dvw!important;height:100vh!important;height:100dvh!important;'
                . 'max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;'
                . 'overflow:hidden!important;z-index:2147483000!important;background:#fff!important;}'
                . '#' . $root_id . '{width:100%!important;height:100%!important;}</style><script id="versace22-chat-relocate">(function(){function move(){var w=document.getElementById(\'versace22-chat-wrapper\');if(w&&w.parentNode!==document.body){document.body.appendChild(w);}if(w){w.style.display=\'block\';w.style.visibility=\'visible\';}var ab=document.getElementById(\'wpadminbar\');if(ab&&ab.parentNode){ab.parentNode.removeChild(ab);}document.documentElement.style.marginTop=\'0\';}if(document.readyState===\'loading\'){document.addEventListener(\'DOMContentLoaded\',move);}else{move();}window.addEventListener(\'load\',move);})();</script>';
            $wrapper = '<div id="' . esc_attr($wrapper_id) . '" data-fullscreen="1"><div id="' . esc_attr($root_id) . '"></div></div>';
        } else {
            $inline_css = '<style id="versace22-chat-inline-css">'
                . '#' . $wrapper_id . '{position:relative;width:100%;}'
                . '#' . $root_id . '{width:100%;height:100%;}</style>';
            $wrapper = '<div id="' . esc_attr($wrapper_id) . '" data-fullscreen="0" style="height:' . $safe_height . ';"><div id="' . esc_attr($root_id) . '"></div></div>';
        }
        return $inline_css . $wrapper;
    }
}

/* ---------- Shortcode handler ---------- */
if (!function_exists('versace22_shortcode_handler')) {
    function versace22_shortcode_handler($atts = array()) {
        $atts = shortcode_atts(array(
            'height'       => '700px',
            'fullscreen'   => 'true',
            'personaid'    => '',
            'persona_id'   => '',
            'show_history' => 'true',
            'allow_upload' => 'true',
            'allow_voice'  => 'true',
        ), $atts, 'ai_chat_persona');
        if ($atts['personaid'] !== '' && $atts['persona_id'] === '') $atts['persona_id'] = $atts['personaid'];
        $atts['personaId'] = $atts['persona_id'];
        return versace22_render_app($atts);
    }
}

/* ---------- Single shortcode owner @ init:99 ---------- */
add_action('init', function () {
    if (shortcode_exists('ai_chat_persona')) remove_shortcode('ai_chat_persona');
    add_shortcode('ai_chat_persona', 'versace22_shortcode_handler');
}, 99);

/* ---------- Option A: user-scoped Memory + Project endpoints (bridge-owned) ---------- */
if (!class_exists('AICPP_User_Endpoints_Inline')) {
    class AICPP_User_Endpoints_Inline {
        public function __construct() {
            // F2 — Memory (user-scoped)
            add_action('wp_ajax_aicpp_user_get_memories', array($this, 'get_memories'));
            add_action('wp_ajax_aicpp_user_add_memory', array($this, 'add_memory'));
            add_action('wp_ajax_aicpp_user_update_memory', array($this, 'update_memory'));
            add_action('wp_ajax_aicpp_user_delete_memory', array($this, 'delete_memory'));
            add_action('wp_ajax_aicpp_user_toggle_memory', array($this, 'toggle_memory'));
            // F3 — Projects (user-scoped read + write)
            add_action('wp_ajax_aicpp_user_list_projects', array($this, 'list_projects'));
            add_action('wp_ajax_aicpp_user_create_project', array($this, 'create_project'));
            add_action('wp_ajax_aicpp_user_update_project', array($this, 'update_project'));
            add_action('wp_ajax_aicpp_user_delete_project', array($this, 'delete_project'));
            // Conversation ↔ Project assignment (user-scoped)
            add_action('wp_ajax_aicpp_user_assign_conversation_project', array($this, 'assign_conversation_project'));
            // Connect Data Sources (user-scoped)
            add_action('wp_ajax_aicpp_user_list_data_sources',      array($this, 'list_data_sources'));
            add_action('wp_ajax_aicpp_user_connect_data_source',    array($this, 'connect_data_source'));
            add_action('wp_ajax_aicpp_user_disconnect_data_source', array($this, 'disconnect_data_source'));
        }
        private function guard() {
            if (!is_user_logged_in()) wp_send_json_error(array('message' => 'login required'), 401);
            check_ajax_referer('aicpp_chat', 'nonce');
        }
        /* ---------- Memory (user-scoped) ----------
         * Main-plugin schema (confirmed): table {prefix}aicpp_memories,
         * columns id, user_id, persona_id, memory_text (varchar 500), enabled.
         */
        public function get_memories() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_memories';
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, persona_id, memory_text, enabled FROM {$t} WHERE user_id = %d ORDER BY id ASC",
                get_current_user_id()
            ));
            wp_send_json_success(array('memories' => $rows ?: array()));
        }
        public function add_memory() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_memories';
            $pid = (int) ($_POST['persona_id'] ?? 0);
            $text = mb_substr(sanitize_text_field(wp_unslash($_POST['memory_text'] ?? '')), 0, 500);
            if ($text === '') wp_send_json_error(array('message' => 'memory_text required'), 422);
            $ok = $wpdb->insert($t, array(
                'user_id'     => get_current_user_id(),
                'persona_id'  => $pid,
                'memory_text' => $text,
                'enabled'     => 1,
            ), array('%d','%d','%s','%d'));
            if ($ok === false) {
                wp_send_json_error(array('message' => 'DB error: '. $wpdb->last_error), 500);
            }
            wp_send_json_success(array('id' => (int) $wpdb->insert_id));
        }
        public function update_memory() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_memories';
            $id = (int) ($_POST['memory_id'] ?? 0);
            $text = mb_substr(sanitize_text_field(wp_unslash($_POST['memory_text'] ?? '')), 0, 500);
            if (!$id || $text === '') wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->update($t, array('memory_text' => $text), array('id' => $id, 'user_id' => get_current_user_id()), array('%s'), array('%d','%d'));
            wp_send_json_success();
        }
        public function delete_memory() {
            $this->guard();
            global $wpdb;
            $id = (int) ($_POST['memory_id'] ?? 0);
            if (!$id) wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->delete($wpdb->prefix . 'aicpp_memories', array('id' => $id, 'user_id' => get_current_user_id()), array('%d','%d'));
            wp_send_json_success();
        }
        public function toggle_memory() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_memories';
            $id = (int) ($_POST['memory_id'] ?? 0);
            if (!$id) wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->query($wpdb->prepare(
                "UPDATE {$t} SET enabled = 1 - enabled WHERE id = %d AND user_id = %d",
                $id, get_current_user_id()
            ));
            wp_send_json_success();
        }
        /* ---------- Projects (user-scoped) ---------- */
        public function list_projects() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_projects';
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, name, description, custom_instructions, color, created_at FROM {$t} WHERE user_id = %d ORDER BY id DESC",
                get_current_user_id()
            ));
            wp_send_json_success(array('projects' => $rows ?: array()));
        }
        public function create_project() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_projects';
            $name = trim(sanitize_text_field(wp_unslash($_POST['name'] ?? '')));
            if ($name === '') wp_send_json_error(array('message' => 'name required'), 422);
            $ok = $wpdb->insert($t, array(
                'user_id'             => get_current_user_id(),
                'name'                => $name,
                'description'         => sanitize_textarea_field(wp_unslash($_POST['description'] ?? '')),
                'custom_instructions' => mb_substr((string) wp_unslash($_POST['custom_instructions'] ?? ''), 0, 50000),
                'color'               => '#667eea',
                'created_at'          => current_time('mysql'),
            ));
            if ($ok === false) {
                wp_send_json_error(array('message' => 'DB error: '. $wpdb->last_error), 500);
            }
            wp_send_json_success(array('id' => (int) $wpdb->insert_id));
        }
        public function update_project() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_projects';
            $id = (int) ($_POST['project_id'] ?? 0);
            $name = trim(sanitize_text_field(wp_unslash($_POST['name'] ?? '')));
            if (!$id || $name === '') wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->update($t, array(
                'name'                => $name,
                'description'         => sanitize_textarea_field(wp_unslash($_POST['description'] ?? '')),
                'custom_instructions' => mb_substr((string) wp_unslash($_POST['custom_instructions'] ?? ''), 0, 50000),
            ), array('id' => $id, 'user_id' => get_current_user_id()));
            wp_send_json_success();
        }
        public function delete_project() {
            $this->guard();
            global $wpdb;
            $id = (int) ($_POST['project_id'] ?? 0);
            if (!$id) wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->delete($wpdb->prefix . 'aicpp_project_files', array('project_id' => $id), array('%d'));
            $wpdb->delete($wpdb->prefix . 'aicpp_projects', array('id' => $id, 'user_id' => get_current_user_id()), array('%d','%d'));
            wp_send_json_success();
        }
        /* ---------- Conversation ↔ Project assignment ---------- */
        public function assign_conversation_project() {
            $this->guard();
            global $wpdb;
            $conv = (int) ($_POST['conversation_id'] ?? 0);
            $raw  = trim((string) wp_unslash($_POST['project_id'] ?? ''));
            $pid  = ($raw === '' || $raw === '0') ? 0 : (int) $raw; // conversations.project_id is bigint DEFAULT 0, NOT NULL
            if (!$conv) wp_send_json_error(array('message' => 'bad request'), 422);
            $c   = $wpdb->prefix . 'aicpp_conversations';
            $uid = get_current_user_id();
            $owns = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$c} WHERE id = %d AND user_id = %d", $conv, $uid
            ));
            if (!$owns) wp_send_json_error(array('message' => 'conversation not found'), 404);
            if ($pid > 0) {
                $p = $wpdb->prefix . 'aicpp_projects';
                $ownsP = (int) $wpdb->get_var($wpdb->prepare(
                    "SELECT COUNT(*) FROM {$p} WHERE id = %d AND user_id = %d", $pid, $uid
                ));
                if (!$ownsP) wp_send_json_error(array('message' => 'project not found'), 404);
            }
            $wpdb->update($c, array('project_id' => $pid), array('id' => $conv, 'user_id' => $uid), array('%d'), array('%d','%d'));
            wp_send_json_success(array('conversation_id' => $conv, 'project_id' => $pid));
        }
        /* ---------- Data Sources (user-scoped) ----------
         * Requires {prefix}aicpp_data_sources table (created by main plugin v12.4+):
         *   id, user_id, provider, label, credentials (TEXT, encrypted), status, created_at
         */
        public function list_data_sources() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_data_sources';
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, provider, label, status, created_at FROM {$t} WHERE user_id = %d ORDER BY id DESC",
                get_current_user_id()
            ));
            wp_send_json_success(array('data_sources' => $rows ?: array()));
        }
        public function connect_data_source() {
            $this->guard();
            global $wpdb;
            $t = $wpdb->prefix . 'aicpp_data_sources';
            $provider    = sanitize_key(wp_unslash($_POST['provider'] ?? ''));
            $label       = sanitize_text_field(wp_unslash($_POST['label'] ?? ''));
            $credentials = trim((string) wp_unslash($_POST['credentials'] ?? ''));
            // Defect A fix: widen allowed providers to match the React frontend catalog (28 sources).
            // 'generic' is the catch-all for any custom API-key connector.
            $allowed = array(
                'generic',
                'notion', 'jira', 'confluence', 'asana', 'trello', 'monday', 'clickup', 'linear',
                'slack', 'discord', 'teams', 'zoom',
                'github', 'gitlab', 'bitbucket',
                'google_drive', 'gmail', 'gcalendar', 'gdocs', 'gsheets',
                'dropbox', 'onedrive', 'box',
                'salesforce', 'hubspot', 'zendesk', 'intercom', 'pipedrive',
                'airtable', 'shopify', 'stripe', 'mailchimp',
                'figma', 'miro',
                'sharepoint', 'outlook',
            );
            // Allow site owners to extend without forking the bridge.
            $allowed = apply_filters('versace22_data_source_allowed_providers', $allowed);
            if (!in_array($provider, $allowed, true) || $credentials === '') {
                wp_send_json_error(array(
                    'message'  => 'provider and credentials required',
                    'provider' => $provider,
                    'allowed'  => $allowed,
                ), 422);
            }
            if ($label === '') $label = ucfirst($provider);
            $enc = $this->enc($credentials);
            $ok = $wpdb->insert($t, array(
                'user_id'     => get_current_user_id(),
                'provider'    => $provider,
                'label'       => $label,
                'credentials' => $enc,
                'status'      => 'connected',
                'created_at'  => current_time('mysql'),
            ), array('%d','%s','%s','%s','%s','%s'));
            if ($ok === false) {
                wp_send_json_error(array('message' => 'DB error: '. $wpdb->last_error), 500);
            }
            wp_send_json_success(array('id' => (int) $wpdb->insert_id, 'provider' => $provider, 'status' => 'connected'));
        }
        public function disconnect_data_source() {
            $this->guard();
            global $wpdb;
            $id = (int) ($_POST['data_source_id'] ?? 0);
            if (!$id) wp_send_json_error(array('message' => 'bad request'), 422);
            $wpdb->delete($wpdb->prefix . 'aicpp_data_sources', array('id' => $id, 'user_id' => get_current_user_id()), array('%d','%d'));
            wp_send_json_success();
        }
        /* ---------- AES-256-CBC encryptor (keyed off wp_salt('auth')) ----------
         * Output format: base64( IV(16) || CIPHERTEXT ). Decryptor in main plugin
         * (ai-chat-persona-pro) must use the same key derivation: hash('sha256', wp_salt('auth'), true).
         */
        private function enc($plaintext) {
            if (!function_exists('openssl_encrypt')) return base64_encode($plaintext);
            $key = hash('sha256', wp_salt('auth'), true);
            $iv  = openssl_random_pseudo_bytes(16);
            $ct  = openssl_encrypt($plaintext, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
            if ($ct === false) return '';
            return base64_encode($iv . $ct);
        }
    }
    add_action('init', function () { new AICPP_User_Endpoints_Inline(); });
}
