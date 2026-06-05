<?php
/**
 * Enqueue VERSACE22 AI Chat Assets
 * Include this file from your main plugin file using:
 * if (file_exists(plugin_dir_path(__FILE__) . 'versace22-enqueue.php')) {
 *     require_once plugin_dir_path(__FILE__) . 'versace22-enqueue.php';
 * }
 */

if (!defined('ABSPATH')) {
    exit;
}

// Add the chat container div to the footer
if (!function_exists('versace22_render_chat_container')) {
    function versace22_render_chat_container() {
        echo '<div id="versace22-chat-root" style="position:fixed;top:0;left:0;z-index:99999;width:100%;height:100dvh;"></div>';
    }
    add_action('wp_footer', 'versace22_render_chat_container');
}

// Enqueue the scoped JS and CSS
if (!function_exists('versace22_enqueue_chat_assets')) {
    function versace22_enqueue_chat_assets() {
        $plugin_url = plugin_dir_url(__FILE__);
        $plugin_path = plugin_dir_path(__FILE__);

        $css_file = $plugin_path . 'Assets/index.css';
        $js_file = $plugin_path . 'Assets/index.js';

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

            // Pass WordPress AJAX config to React app
            global $wpdb;
            $table_personas = $wpdb->prefix . 'aicpp_personas';
            $default_persona = $wpdb->get_row("SELECT id FROM {$table_personas} WHERE is_default=1 LIMIT 1");
            $persona_id = $default_persona ? $default_persona->id : 1;

            $current_user = wp_get_current_user();
            $is_logged_in = is_user_logged_in();

            wp_localize_script('versace22-chat-script', 'versace22_chat', array(
                'ajaxurl'            => admin_url('admin-ajax.php'),
                'nonce'              => wp_create_nonce('aicpp_chat'),
                'persona_id'         => $persona_id,
                'session_id'         => 'sess_' . wp_generate_uuid4(),
                'user_logged_in'     => $is_logged_in,
                'user_display_name'  => $is_logged_in ? $current_user->display_name : '',
                'user_email'         => $is_logged_in ? $current_user->user_email : '',
                'user_avatar'        => $is_logged_in ? get_avatar_url($current_user->ID) : '',
                'logout_url'         => wp_logout_url(home_url()),
            ));
        }
    }
    add_action('wp_enqueue_scripts', 'versace22_enqueue_chat_assets');
}

// Helper function to render the React app container (called from shortcode)
if (!function_exists('versace22_render_app')) {
    function versace22_render_app($args = array()) {
        $persona_id = isset($args['personaId']) ? intval($args['personaId']) : 1;
        $height = isset($args['height']) ? esc_attr($args['height']) : '700px';

        // Override the default persona_id with the shortcode one
        $script = "<script>
            if (window.versace22_chat) {
                window.versace22_chat.persona_id = " . json_encode($persona_id) . ";
            }
        </script>";

        return $script . '<div id="versace22-chat-root" style="position:relative;width:100%;height:' . $height . ';"></div>';
    }
}
