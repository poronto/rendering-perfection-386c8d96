<?php
/**
 * Enqueue VERSACE22 AI Chat Assets
 * v2 — exposes additional nonces (admin `aicpp` for Memories/Projects/OpenRouter cards),
 *      the current user id + admin flag, and tags admin settings pages with a body class
 *      so the React bundle can mount the admin-only OpenRouter free-models card.
 *
 * Include from your main plugin file:
 *   if (file_exists(plugin_dir_path(__FILE__) . 'versace22-enqueue.php')) {
 *       require_once plugin_dir_path(__FILE__) . 'versace22-enqueue.php';
 *   }
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ------------------------------------------------------------------
 * FRONTEND: render the chat root + enqueue scoped JS/CSS
 * ---------------------------------------------------------------- */
if (!function_exists('versace22_render_chat_container')) {
    function versace22_render_chat_container() {
        if (is_admin()) return;
        echo '<div id="versace22-chat-root" style="position:fixed;top:0;left:0;z-index:99999;width:100%;height:100dvh;"></div>';
    }
    add_action('wp_footer', 'versace22_render_chat_container');
}

if (!function_exists('versace22_enqueue_chat_assets')) {
    function versace22_enqueue_chat_assets() {
        $plugin_url  = plugin_dir_url(__FILE__);
        $plugin_path = plugin_dir_path(__FILE__);

        $css_file = $plugin_path . 'Assets/index.css';
        $js_file  = $plugin_path . 'Assets/index.js';

        if (file_exists($css_file)) {
            wp_enqueue_style(
                'versace22-chat-style',
                $plugin_url . 'Assets/index.css',
                array(),
                filemtime($css_file)
            );
        }

        if (file_exists($js_file)) {
            wp_enqueue_script(
                'versace22-chat-script',
                $plugin_url . 'Assets/index.js',
                array(),
                filemtime($js_file),
                true
            );

            global $wpdb;
            $table_personas = $wpdb->prefix . 'aicpp_personas';
            $default_persona = $wpdb->get_row("SELECT id FROM {$table_personas} WHERE is_default=1 LIMIT 1");
            $persona_id = $default_persona ? (int) $default_persona->id : 1;

            $current_user = wp_get_current_user();
            $is_logged_in = is_user_logged_in();
            $is_admin     = $is_logged_in && current_user_can('manage_options');

            wp_localize_script('versace22-chat-script', 'versace22_chat', array(
                'ajaxurl'            => admin_url('admin-ajax.php'),
                // Frontend chat nonce (covers chat, upload, transcribe, speak,
                // search_messages, pin_conversation, artifact CRUD, assign_conversation_project).
                'nonce'              => wp_create_nonce('aicpp_chat'),
                // Admin nonce (Memories, Projects CRUD, OpenRouter free models). Only useful for admins.
                'admin_nonce'        => $is_admin ? wp_create_nonce('aicpp') : '',
                'register_nonce'     => wp_create_nonce('aicpp_register'),
                'login_nonce'        => wp_create_nonce('aicpp_login'),
                'persona_id'         => $persona_id,
                'session_id'         => 'sess_' . wp_generate_uuid4(),
                'user_id'            => (int) ($is_logged_in ? $current_user->ID : 0),
                'is_admin'           => $is_admin ? 1 : 0,
                'user_logged_in'     => $is_logged_in,
                'user_display_name'  => $is_logged_in ? $current_user->display_name : '',
                'user_email'         => $is_logged_in ? $current_user->user_email : '',
                'user_avatar'        => $is_logged_in ? get_avatar_url($current_user->ID) : '',
                'logout_url'         => wp_logout_url(home_url()),
                'plugin_version'     => '12.3',
            ));
        }
    }
    add_action('wp_enqueue_scripts', 'versace22_enqueue_chat_assets');
}

/* ------------------------------------------------------------------
 * ADMIN: tag the AI Chat Pro Settings page with a body class so the
 * React bundle can detect it and mount the OpenRouter free-models card.
 * ---------------------------------------------------------------- */
if (!function_exists('versace22_admin_settings_body_class')) {
    function versace22_admin_settings_body_class($classes) {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if ($screen && isset($screen->id) && strpos($screen->id, 'aicpp-settings') !== false) {
            $classes .= ' aicpp-settings-page';
        }
        return $classes;
    }
    add_filter('admin_body_class', 'versace22_admin_settings_body_class');
}

/* ------------------------------------------------------------------
 * ADMIN: enqueue the same bundle on the AI Chat Pro Settings page so
 * the OpenRouter free-models card can render. Uses the admin nonce.
 * ---------------------------------------------------------------- */
if (!function_exists('versace22_admin_enqueue')) {
    function versace22_admin_enqueue($hook) {
        if (strpos($hook, 'aicpp-settings') === false) return;
        $plugin_url  = plugin_dir_url(__FILE__);
        $plugin_path = plugin_dir_path(__FILE__);
        $css_file = $plugin_path . 'Assets/index.css';
        $js_file  = $plugin_path . 'Assets/index.js';

        if (file_exists($css_file)) {
            wp_enqueue_style('versace22-chat-style-admin', $plugin_url . 'Assets/index.css', array(), filemtime($css_file));
        }
        if (file_exists($js_file)) {
            wp_enqueue_script('versace22-chat-script-admin', $plugin_url . 'Assets/index.js', array(), filemtime($js_file), true);
            $current_user = wp_get_current_user();
            wp_localize_script('versace22-chat-script-admin', 'versace22_chat', array(
                'ajaxurl'            => admin_url('admin-ajax.php'),
                'nonce'              => wp_create_nonce('aicpp_chat'),
                'admin_nonce'        => wp_create_nonce('aicpp'),
                'persona_id'         => 1,
                'session_id'         => 'sess_admin_' . wp_generate_uuid4(),
                'user_id'            => (int) $current_user->ID,
                'is_admin'           => 1,
                'user_logged_in'     => true,
                'user_display_name'  => $current_user->display_name,
                'is_settings_page'   => 1,
                'plugin_version'     => '12.3',
            ));
        }
    }
    add_action('admin_enqueue_scripts', 'versace22_admin_enqueue');
}

/* ------------------------------------------------------------------
 * Shortcode helper (unchanged behaviour, kept for backward compat).
 * ---------------------------------------------------------------- */
if (!function_exists('versace22_render_app')) {
    function versace22_render_app($args = array()) {
        $persona_id = isset($args['personaId']) ? intval($args['personaId']) : 1;
        $height     = isset($args['height']) ? esc_attr($args['height']) : '700px';

        $script = "<script>
            if (window.versace22_chat) {
                window.versace22_chat.persona_id = " . json_encode($persona_id) . ";
            }
        </script>";

        return $script . '<div id="versace22-chat-root" style="position:relative;width:100%;height:' . $height . ';"></div>';
    }
}
