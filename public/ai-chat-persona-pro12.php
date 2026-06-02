<?php
/**
 * Plugin Name: AI Chat Persona Pro - Ultimate Character Engine
 * Description: AI Chat with Main Site Character, Public/Private Personas, Per-Client Assignment, Emotional Intelligence, Rewards System, Character Binding & 5-Slot Hidden Injection
 * Version: 12.0
 * Author: AI Pipeline Pro
 */

if (!defined('ABSPATH')) exit;

class AI_Chat_Persona_Pro_Ultimate {

    private static $instance = null;
    private $table_conversations;
    private $table_messages;
    private $table_personas;
    private $table_persona_assignments;
    private $table_analytics;
    private $table_injection_log;
    private $table_injection_state;
    private $version = '12.0';

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        global $wpdb;
        $this->table_conversations      = $wpdb->prefix . 'aicpp_conversations';
        $this->table_messages            = $wpdb->prefix . 'aicpp_messages';
        $this->table_personas            = $wpdb->prefix . 'aicpp_personas';
        $this->table_persona_assignments = $wpdb->prefix . 'aicpp_persona_assignments';
        $this->table_analytics           = $wpdb->prefix . 'aicpp_analytics';
        $this->table_injection_log       = $wpdb->prefix . 'aicpp_injection_log';
        $this->table_injection_state     = $wpdb->prefix . 'aicpp_injection_state';

        register_activation_hook(__FILE__, [$this, 'activate']);
        add_action('admin_menu', [$this, 'add_admin_menus']);
        add_action('admin_head', [$this, 'admin_styles']);
        add_action('admin_init', [$this, 'check_db_upgrade']);

        // Admin AJAX
        add_action('wp_ajax_aicpp_save_persona', [$this, 'ajax_save_persona']);
        add_action('wp_ajax_aicpp_delete_persona', [$this, 'ajax_delete_persona']);
        add_action('wp_ajax_aicpp_get_persona', [$this, 'ajax_get_persona']);
        add_action('wp_ajax_aicpp_search_users', [$this, 'ajax_search_users']);
        add_action('wp_ajax_aicpp_get_persona_users', [$this, 'ajax_get_persona_users']);
        add_action('wp_ajax_aicpp_assign_persona', [$this, 'ajax_assign_persona']);
        add_action('wp_ajax_aicpp_unassign_persona', [$this, 'ajax_unassign_persona']);
        add_action('wp_ajax_aicpp_get_user_personas', [$this, 'ajax_get_user_personas']);
        add_action('wp_ajax_aicpp_bulk_assign', [$this, 'ajax_bulk_assign']);

        // Public + logged-in AJAX
        add_action('wp_ajax_aicpp_chat', [$this, 'handle_chat']);
        add_action('wp_ajax_nopriv_aicpp_chat', [$this, 'handle_chat']);
        add_action('wp_ajax_aicpp_get_my_personas', [$this, 'ajax_get_my_personas']);
        add_action('wp_ajax_nopriv_aicpp_get_my_personas', [$this, 'ajax_get_my_personas']);
        add_action('wp_ajax_aicpp_get_conversations', [$this, 'ajax_get_conversations']);
        add_action('wp_ajax_nopriv_aicpp_get_conversations', [$this, 'ajax_get_conversations']);
        add_action('wp_ajax_aicpp_load_conversation', [$this, 'ajax_load_conversation']);
        add_action('wp_ajax_nopriv_aicpp_load_conversation', [$this, 'ajax_load_conversation']);
        add_action('wp_ajax_aicpp_delete_conversation', [$this, 'ajax_delete_conversation']);
        add_action('wp_ajax_nopriv_aicpp_delete_conversation', [$this, 'ajax_delete_conversation']);
        add_action('wp_ajax_aicpp_upload_file', [$this, 'ajax_upload_file']);
        add_action('wp_ajax_nopriv_aicpp_upload_file', [$this, 'ajax_upload_file']);
        add_action('wp_ajax_aicpp_transcribe_audio', [$this, 'ajax_transcribe_audio']);
        add_action('wp_ajax_nopriv_aicpp_transcribe_audio', [$this, 'ajax_transcribe_audio']);
        add_action('wp_ajax_nopriv_aicpp_register_user', [$this, 'ajax_register_user']);
        add_action('wp_ajax_nopriv_aicpp_login_user', [$this, 'ajax_login_user']);

        // Main character chat (no persona_id needed)
        add_action('wp_ajax_aicpp_chat_main', [$this, 'handle_chat_main']);
        add_action('wp_ajax_nopriv_aicpp_chat_main', [$this, 'handle_chat_main']);

        add_shortcode('ai_chat_persona', [$this, 'chat_shortcode']);
    }

    // ===================== DB UPGRADE CHECK =====================
    public function check_db_upgrade() {
        $db_version = get_option('aicpp_db_version', '0');
        if (version_compare($db_version, $this->version, '<')) {
            $this->activate();
            update_option('aicpp_db_version', $this->version);
        }
    }

    // ===================== ACTIVATION =====================
    public function activate() {
        global $wpdb;
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        $charset = $wpdb->get_charset_collate();

        dbDelta("CREATE TABLE {$this->table_conversations} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) DEFAULT 0,
            persona_id bigint(20) DEFAULT NULL,
            session_id varchar(255) NOT NULL,
            title varchar(255) DEFAULT '',
            token_count int(11) DEFAULT 0,
            is_main_chat tinyint(1) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY idx_session_id (session_id),
            KEY idx_user_id (user_id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_messages} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            conversation_id bigint(20) NOT NULL,
            role varchar(20) NOT NULL,
            content longtext NOT NULL,
            raw_content longtext,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY idx_conversation_id (conversation_id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_personas} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            description text,
            avatar_initials varchar(10) DEFAULT '',
            avatar_color varchar(20) DEFAULT '#667eea',
            system_prompt longtext NOT NULL,
            emotional_intelligence_code longtext,
            rewards_code longtext,
            use_global_ei tinyint(1) DEFAULT 1,
            use_global_rewards tinyint(1) DEFAULT 1,
            model varchar(100) DEFAULT 'gpt-4',
            temperature decimal(3,2) DEFAULT 0.70,
            max_tokens int(11) DEFAULT 2000,
            visibility varchar(20) DEFAULT 'private',
            created_by bigint(20) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_persona_assignments} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            persona_id bigint(20) NOT NULL,
            user_id bigint(20) NOT NULL,
            assigned_by bigint(20) NOT NULL,
            assigned_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY idx_persona_user (persona_id,user_id),
            KEY idx_user_id (user_id),
            KEY idx_persona_id (persona_id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_analytics} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            event_type varchar(100),
            tokens_used int(11) DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_injection_log} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id varchar(100),
            slot_used int(11),
            message_preview text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id)
        ) $charset;");

        dbDelta("CREATE TABLE {$this->table_injection_state} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_key varchar(255) NOT NULL,
            current_slot int(11) DEFAULT 1,
            question_count int(11) DEFAULT 1,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY idx_user_key (user_key)
        ) $charset;");

        $this->create_defaults();
    }

    private function create_defaults() {
        $defaults = [
            'aicpp_api_provider'            => 'openai',
            'aicpp_openai_api_key'          => '',
            'aicpp_anthropic_api_key'       => '',
            'aicpp_google_api_key'          => '',
            'aicpp_deepseek_api_key'        => '',
            'aicpp_openrouter_api_key'      => '',
            'aicpp_mistral_api_key'         => '',
            'aicpp_groq_api_key'            => '',
            'aicpp_character_binding_active' => '0',
            'aicpp_active_character_code'   => '',
            'aicpp_global_ei_enabled'       => '0',
            'aicpp_global_ei_code'          => '',
            'aicpp_global_rewards_enabled'  => '0',
            'aicpp_global_rewards_code'     => '',
            'aicpp_injection_enabled'       => '0',
            'aicpp_max_message_length'      => '10000',
            'aicpp_require_login'           => '1',
            'aicpp_login_message'           => 'Please sign in to access your AI assistant.',
            // Main Site Character defaults
            'aicpp_main_char_enabled'       => '0',
            'aicpp_main_char_name'          => 'AI Assistant',
            'aicpp_main_char_description'   => 'Your helpful AI assistant',
            'aicpp_main_char_avatar_initials' => 'AI',
            'aicpp_main_char_avatar_color'  => '#667eea',
            'aicpp_main_char_system_prompt' => 'You are a helpful, friendly AI assistant. Answer questions accurately and helpfully.',
            'aicpp_main_char_model'         => 'gpt-4',
            'aicpp_main_char_temperature'   => '0.7',
            'aicpp_main_char_max_tokens'    => '2000',
        ];
        foreach ($defaults as $k => $v) {
            add_option($k, $v);
        }
        for ($i = 1; $i <= 5; $i++) {
            add_option("aicpp_slot{$i}_enabled", '1');
            add_option("aicpp_hidden_message_{$i}", '');
        }
    }

    // ===================== ENCRYPTION HELPERS =====================
    private function encrypt_api_key($plain) {
        if (empty($plain)) return '';
        $key = wp_salt('auth');
        $iv_length = openssl_cipher_iv_length('aes-256-cbc');
        $iv = openssl_random_pseudo_bytes($iv_length);
        $encrypted = openssl_encrypt($plain, 'aes-256-cbc', $key, 0, $iv);
        return base64_encode($iv . '::' . $encrypted);
    }

    private function decrypt_api_key($stored) {
        if (empty($stored)) return '';
        $key = wp_salt('auth');
        $data = base64_decode($stored);
        if ($data === false) return $stored;
        $parts = explode('::', $data, 2);
        if (count($parts) !== 2) return $stored;
        list($iv, $encrypted) = $parts;
        $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, 0, $iv);
        return $decrypted !== false ? $decrypted : $stored;
    }

    private function get_api_key($provider) {
        return $this->decrypt_api_key(get_option("aicpp_{$provider}_api_key", ''));
    }

    // ===================== RATE LIMITING =====================
    private function check_rate_limit($action, $limit = 5, $window = 300) {
        $ip = $this->get_client_ip();
        $transient_key = 'aicpp_rl_' . md5($action . $ip);
        $attempts = get_transient($transient_key);
        if ($attempts === false) {
            set_transient($transient_key, 1, $window);
            return true;
        }
        if ($attempts >= $limit) return false;
        set_transient($transient_key, $attempts + 1, $window);
        return true;
    }

    private function get_client_ip() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }

    // ===================== CONVERSATION OWNERSHIP =====================
    private function verify_conversation_ownership($conv) {
        $user_id = get_current_user_id();
        if ($user_id) return (int)$conv->user_id === $user_id;
        $session_id = sanitize_text_field($_POST['session_id'] ?? '');
        return !empty($session_id) && $conv->session_id === $session_id;
    }

    // ===================== PERSONA ACCESS CHECK =====================
    private function user_can_access_persona($user_id, $persona_id) {
        if (!$user_id) return false;
        if (user_can($user_id, 'manage_options')) return true;

        global $wpdb;

        // Check if persona is public — everyone can access
        $visibility = $wpdb->get_var($wpdb->prepare(
            "SELECT visibility FROM {$this->table_personas} WHERE id = %d",
            $persona_id
        ));
        if ($visibility === 'public') return true;

        // Private persona — check assignment
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->table_persona_assignments} WHERE persona_id = %d AND user_id = %d",
            $persona_id, $user_id
        ));
        return (int)$count > 0;
    }

    /**
     * Get all personas a user can access:
     * - All public personas
     * - All private personas assigned to them
     * - Admins see everything
     */
    private function get_user_personas($user_id) {
        global $wpdb;

        if (user_can($user_id, 'manage_options')) {
            return $wpdb->get_results("SELECT * FROM {$this->table_personas} ORDER BY name ASC");
        }

        // Public personas + privately assigned personas
        return $wpdb->get_results($wpdb->prepare(
            "SELECT DISTINCT p.* FROM {$this->table_personas} p
             LEFT JOIN {$this->table_persona_assignments} pa ON p.id = pa.persona_id AND pa.user_id = %d
             WHERE p.visibility = 'public' OR pa.user_id = %d
             ORDER BY p.name ASC",
            $user_id, $user_id
        ));
    }

    // ===================== ADMIN STYLES =====================
    public function admin_styles() {
        $page = $_GET['page'] ?? '';
        if (strpos($page, 'aicpp') === false && $page !== 'ai-chat-persona-pro') return;
        ?>
        <style>
        .aicpp-wrap{max-width:1400px;margin:20px 20px 20px 0}
        .aicpp-card{background:#fff;border:1px solid #ccd0d4;border-radius:8px;padding:25px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .aicpp-card h2{margin-top:0;padding-bottom:15px;border-bottom:2px solid #f0f0f1}
        .aicpp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin:20px 0}
        .aicpp-stat{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:25px;border-radius:12px;text-align:center}
        .aicpp-stat h3{font-size:36px;margin:0 0 5px}
        .aicpp-stat p{margin:0;opacity:.9}
        .aicpp-code{background:#1e1e1e;border-radius:8px;padding:5px;margin:15px 0}
        .aicpp-code textarea{width:100%;min-height:200px;background:#23282d;color:#50fa7b;border:none;padding:15px;font-family:Consolas,monospace;font-size:13px;border-radius:6px;box-sizing:border-box}
        .aicpp-info{background:#e7f5ff;border-left:4px solid #228be6;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0}
        .aicpp-warning{background:#fff3bf;border-left:4px solid #fab005;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0}
        .aicpp-success{background:#d3f9d8;border-left:4px solid #40c057;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0}
        .aicpp-grid-5{display:grid;grid-template-columns:repeat(5,1fr);gap:15px}
        .aicpp-slot{background:#fff;border:2px solid #dee2e6;border-radius:10px;padding:15px}
        .aicpp-slot.s1{border-color:#228be6;background:linear-gradient(to bottom,#e7f5ff,#fff)}
        .aicpp-slot.s2{border-color:#40c057;background:linear-gradient(to bottom,#d3f9d8,#fff)}
        .aicpp-slot.s3{border-color:#fab005;background:linear-gradient(to bottom,#fff3bf,#fff)}
        .aicpp-slot.s4{border-color:#fd7e14;background:linear-gradient(to bottom,#ffe8cc,#fff)}
        .aicpp-slot.s5{border-color:#e64980;background:linear-gradient(to bottom,#ffdeeb,#fff)}
        .aicpp-slot h3{font-size:14px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
        .aicpp-slot textarea{width:100%;min-height:150px;font-family:monospace;font-size:12px;border:1px solid #ddd;border-radius:6px;padding:10px;box-sizing:border-box}
        .aicpp-personas{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-top:25px}
        .aicpp-pcard{background:#fff;border:1px solid #dee2e6;border-radius:10px;padding:20px;transition:.2s}
        .aicpp-pcard:hover{box-shadow:0 5px 20px rgba(0,0,0,.1);transform:translateY(-3px)}
        .aicpp-badge{background:#667eea;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;display:inline-block;margin:2px}
        .aicpp-badge-green{background:#40c057;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;display:inline-block;margin:2px}
        .aicpp-badge-orange{background:#fd7e14;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;display:inline-block;margin:2px}
        .aicpp-badge-red{background:#e64980;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;display:inline-block;margin:2px}
        .aicpp-badge-blue{background:#228be6;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;display:inline-block;margin:2px}
        .aicpp-on{background:#d3f9d8;color:#2b8a3e;padding:8px 16px;border-radius:20px;font-weight:600;display:inline-block}
        .aicpp-off{background:#ffe3e3;color:#c92a2a;padding:8px 16px;border-radius:20px;font-weight:600;display:inline-block}
        .aicpp-modal{display:none;position:fixed;z-index:100000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,.6);align-items:center;justify-content:center}
        .aicpp-mbox{background:#fff;padding:30px;border-radius:12px;max-width:900px;width:90%;max-height:90vh;overflow-y:auto;position:relative}
        .aicpp-close{position:absolute;right:15px;top:10px;font-size:28px;cursor:pointer;color:#868e96}
        .aicpp-flow{display:flex;align-items:center;justify-content:center;gap:10px;padding:20px;background:#f8f9fa;border-radius:10px;margin:20px 0;flex-wrap:wrap}
        .aicpp-flow-item{padding:10px 15px;border-radius:8px;font-weight:600;font-size:13px}
        .aicpp-flow-arrow{color:#adb5bd;font-size:20px}
        .aicpp-provider-card{border:2px solid #dee2e6;border-radius:10px;padding:20px;margin-bottom:15px;transition:.2s}
        .aicpp-provider-card.active{border-color:#667eea;background:#f8f9ff}
        .aicpp-provider-card h4{margin:0 0 10px;display:flex;align-items:center;gap:10px}
        .aicpp-provider-badge{font-size:11px;padding:3px 8px;border-radius:10px;background:#e9ecef}
        .aicpp-provider-badge.connected{background:#d3f9d8;color:#2b8a3e}
        .aicpp-providers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:20px}
        .aicpp-assign-section{border:2px solid #e9ecef;border-radius:10px;padding:20px;margin-top:20px;background:#f8f9fa}
        .aicpp-assign-section h3{margin:0 0 15px;font-size:16px}
        .aicpp-user-search{display:flex;gap:10px;margin-bottom:15px}
        .aicpp-user-search input{flex:1;padding:10px 15px;border:2px solid #dee2e6;border-radius:8px;font-size:14px}
        .aicpp-user-search button{padding:10px 20px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap}
        .aicpp-user-search button:hover{background:#5a6fd6}
        .aicpp-user-results{max-height:200px;overflow-y:auto;border:1px solid #dee2e6;border-radius:8px;background:#fff}
        .aicpp-user-row{display:flex;justify-content:space-between;align-items:center;padding:10px 15px;border-bottom:1px solid #f0f0f1;transition:.2s}
        .aicpp-user-row:last-child{border-bottom:none}
        .aicpp-user-row:hover{background:#f8f9ff}
        .aicpp-user-row .user-info{display:flex;flex-direction:column}
        .aicpp-user-row .user-name{font-weight:600;font-size:14px}
        .aicpp-user-row .user-email{font-size:12px;color:#868e96}
        .aicpp-user-row .user-login{font-size:11px;color:#adb5bd}
        .aicpp-user-row button{padding:5px 12px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600}
        .aicpp-user-row .btn-assign{background:#667eea;color:#fff}
        .aicpp-user-row .btn-assign:hover{background:#5a6fd6}
        .aicpp-user-row .btn-remove{background:#ffe3e3;color:#c92a2a}
        .aicpp-user-row .btn-remove:hover{background:#ffc9c9}
        .aicpp-assigned-list{margin-top:15px}
        .aicpp-assigned-list h4{margin:0 0 10px;font-size:14px;color:#495057}
        .aicpp-empty{text-align:center;padding:20px;color:#adb5bd;font-size:14px}
        .aicpp-user-card{background:#fff;border:1px solid #dee2e6;border-radius:10px;padding:20px;margin-bottom:15px}
        .aicpp-user-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
        .aicpp-user-card-header h3{margin:0}
        .aicpp-persona-tags{display:flex;flex-wrap:wrap;gap:6px}
        .aicpp-section-icon{font-size:20px;margin-right:8px;vertical-align:middle}
        @media(max-width:1200px){.aicpp-grid-5{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:782px){.aicpp-grid-5{grid-template-columns:1fr}.aicpp-providers-grid{grid-template-columns:1fr}}
        </style>
        <?php
    }

    // ===================== ADMIN MENUS (with emojis) =====================
    public function add_admin_menus() {
        add_menu_page(
            'AI Chat Pro',
            '💬 AI Chat Pro',
            'manage_options',
            'ai-chat-persona-pro',
            [$this, 'page_dashboard'],
            'dashicons-format-chat',
            30
        );
        add_submenu_page('ai-chat-persona-pro', 'Dashboard', '📊 Dashboard', 'manage_options', 'ai-chat-persona-pro', [$this, 'page_dashboard']);
        add_submenu_page('ai-chat-persona-pro', 'Main Character', '🌟 Main Character', 'manage_options', 'aicpp-main-character', [$this, 'page_main_character']);
        add_submenu_page('ai-chat-persona-pro', 'Personas', '🎭 Personas', 'manage_options', 'aicpp-personas', [$this, 'page_personas']);
        add_submenu_page('ai-chat-persona-pro', 'Character Binding', '🔗 Character Binding', 'manage_options', 'aicpp-binding', [$this, 'page_binding']);
        add_submenu_page('ai-chat-persona-pro', 'Emotional Intelligence', '🧠 Emotional Intelligence', 'manage_options', 'aicpp-ei', [$this, 'page_ei']);
        add_submenu_page('ai-chat-persona-pro', 'Rewards System', '🏆 Rewards System', 'manage_options', 'aicpp-rewards', [$this, 'page_rewards']);
        add_submenu_page('ai-chat-persona-pro', 'Hidden Injection', '💉 Hidden Injection', 'manage_options', 'aicpp-injection', [$this, 'page_injection']);
        add_submenu_page('ai-chat-persona-pro', 'Settings', '⚙️ Settings', 'manage_options', 'aicpp-settings', [$this, 'page_settings']);
    }

    // ===================== DASHBOARD =====================
    public function page_dashboard() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        global $wpdb;
        $convos       = (int)($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_conversations}") ?: 0);
        $personas     = (int)($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_personas}") ?: 0);
        $public_count = (int)($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_personas} WHERE visibility = 'public'") ?: 0);
        $private_count = (int)($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_personas} WHERE visibility = 'private'") ?: 0);
        $tokens       = (int)($wpdb->get_var("SELECT SUM(token_count) FROM {$this->table_conversations}") ?: 0);
        $assignments  = (int)($wpdb->get_var("SELECT COUNT(*) FROM {$this->table_persona_assignments}") ?: 0);
        $clients      = (int)($wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$this->table_persona_assignments}") ?: 0);
        $main_enabled = get_option('aicpp_main_char_enabled', '0') === '1';
        $main_name    = get_option('aicpp_main_char_name', 'AI Assistant');
        $provider     = get_option('aicpp_api_provider', 'openai');
        $provider_names = [
            'openai' => 'OpenAI', 'anthropic' => 'Anthropic (Claude)', 'google' => 'Google (Gemini)',
            'deepseek' => 'DeepSeek', 'openrouter' => 'OpenRouter', 'mistral' => 'Mistral AI', 'groq' => 'Groq',
        ];
        ?>
        <div class="wrap aicpp-wrap">
            <h1>💬 AI Chat Persona Pro — Dashboard</h1>

            <div class="aicpp-card">
                <h2><span class="aicpp-section-icon">🏠</span> Welcome to AI Chat Persona Pro v<?php echo esc_html($this->version); ?></h2>
                <p>Create AI personas, configure a <strong>Main Site Character</strong>, and assign <strong>public or private personas</strong> to specific clients.</p>
                <p><strong>🔌 Active Provider:</strong> <span class="aicpp-badge"><?php echo esc_html($provider_names[$provider] ?? $provider); ?></span></p>
                <p><strong>🌟 Main Character:</strong>
                    <?php if ($main_enabled): ?>
                        <span class="aicpp-on">✅ ACTIVE — <?php echo esc_html($main_name); ?></span>
                    <?php else: ?>
                        <span class="aicpp-off">❌ INACTIVE</span>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-main-character')); ?>" class="button button-small" style="margin-left:10px">Configure</a>
                    <?php endif; ?>
                </p>
            </div>

            <div class="aicpp-stats">
                <div class="aicpp-stat"><h3><?php echo number_format($personas); ?></h3><p>🎭 Total Personas</p></div>
                <div class="aicpp-stat" style="background:linear-gradient(135deg,#228be6,#667eea)"><h3><?php echo number_format($public_count); ?></h3><p>🌍 Public Personas</p></div>
                <div class="aicpp-stat" style="background:linear-gradient(135deg,#fd7e14,#e64980)"><h3><?php echo number_format($private_count); ?></h3><p>🔒 Private Personas</p></div>
                <div class="aicpp-stat" style="background:linear-gradient(135deg,#40c057,#228be6)"><h3><?php echo number_format($clients); ?></h3><p>👥 Active Clients</p></div>
                <div class="aicpp-stat" style="background:linear-gradient(135deg,#fab005,#fd7e14)"><h3><?php echo number_format($convos); ?></h3><p>💬 Conversations</p></div>
                <div class="aicpp-stat" style="background:linear-gradient(135deg,#e64980,#be4bdb)"><h3><?php echo number_format($tokens); ?></h3><p>🪙 Tokens Used</p></div>
            </div>

            <div class="aicpp-card">
                <h2><span class="aicpp-section-icon">🔄</span> How It Works</h2>
                <div class="aicpp-flow">
                    <div class="aicpp-flow-item" style="background:#228be6;color:#fff">🌟 Main Character<br><small>Everyone chats here</small></div>
                    <span class="aicpp-flow-arrow">+</span>
                    <div class="aicpp-flow-item" style="background:#40c057;color:#fff">🌍 Public Personas<br><small>All registered users</small></div>
                    <span class="aicpp-flow-arrow">+</span>
                    <div class="aicpp-flow-item" style="background:#fd7e14;color:#fff">🔒 Private Personas<br><small>Assigned clients only</small></div>
                </div>
                <div class="aicpp-info">
                    <strong>📋 Free User Flow:</strong> Registers → Chats with <strong>Main Character</strong> → Sees <strong>Public Personas</strong> in sidebar → Gets 1 gift persona to encourage subscription.
                </div>
                <div class="aicpp-success">
                    <strong>💎 Paid Subscriber Flow:</strong> Logs in → Chats with <strong>Main Character</strong> → Sees <strong>Public + Private Personas</strong> assigned to their account in sidebar.
                </div>
            </div>

            <div class="aicpp-card">
                <h2><span class="aicpp-section-icon">⚡</span> Quick Actions</h2>
                <p>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-main-character')); ?>" class="button button-primary" style="background:#228be6;border-color:#228be6">🌟 Main Character</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-personas')); ?>" class="button button-primary">🎭 Create Persona</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-binding')); ?>" class="button">🔗 Character Binding</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-ei')); ?>" class="button">🧠 Emotional Intelligence</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-rewards')); ?>" class="button">🏆 Rewards</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-injection')); ?>" class="button">💉 Hidden Injection</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=aicpp-settings')); ?>" class="button">⚙️ Settings</a>
                </p>
            </div>

            <div class="aicpp-card">
                <h2><span class="aicpp-section-icon">📌</span> Shortcode</h2>
                <code style="display:block;padding:15px;background:#f1f3f5;border-radius:6px">[ai_chat_persona height="700px" show_history="true" allow_upload="true" allow_voice="true"]</code>
                <p class="description" style="margin-top:10px">The <strong>Main Character</strong> appears as the default chat. Personas appear in the sidebar under "My Personas".</p>
            </div>
        </div>
        <?php
    }

    // ===================== MAIN CHARACTER PAGE =====================
    public function page_main_character() {
        if (!current_user_can('manage_options')) wp_die('Access denied');

        if (isset($_POST['save_main_char']) && check_admin_referer('aicpp_main_char')) {
            update_option('aicpp_main_char_enabled', isset($_POST['enabled']) ? '1' : '0');
            update_option('aicpp_main_char_name', sanitize_text_field($_POST['name'] ?? 'AI Assistant'));
            update_option('aicpp_main_char_description', sanitize_textarea_field($_POST['description'] ?? ''));
            update_option('aicpp_main_char_avatar_initials', sanitize_text_field(mb_substr($_POST['avatar_initials'] ?? 'AI', 0, 4)));
            update_option('aicpp_main_char_avatar_color', sanitize_hex_color($_POST['avatar_color'] ?? '#667eea') ?: '#667eea');
            update_option('aicpp_main_char_system_prompt', wp_kses_post($_POST['system_prompt'] ?? ''));
            update_option('aicpp_main_char_model', sanitize_text_field($_POST['model'] ?? 'gpt-4'));
            update_option('aicpp_main_char_temperature', max(0.0, min(2.0, floatval($_POST['temperature'] ?? 0.7))));
            update_option('aicpp_main_char_max_tokens', max(1, min(128000, intval($_POST['max_tokens'] ?? 2000))));
            echo '<div class="notice notice-success"><p>✅ Main Character saved successfully!</p></div>';
        }

        $enabled     = get_option('aicpp_main_char_enabled', '0') === '1';
        $name        = get_option('aicpp_main_char_name', 'AI Assistant');
        $description = get_option('aicpp_main_char_description', 'Your helpful AI assistant');
        $initials    = get_option('aicpp_main_char_avatar_initials', 'AI');
        $color       = get_option('aicpp_main_char_avatar_color', '#667eea');
        $prompt      = get_option('aicpp_main_char_system_prompt', 'You are a helpful, friendly AI assistant.');
        $model       = get_option('aicpp_main_char_model', 'gpt-4');
        $temperature = get_option('aicpp_main_char_temperature', '0.7');
        $max_tokens  = get_option('aicpp_main_char_max_tokens', '2000');
        ?>
        <div class="wrap aicpp-wrap">
            <h1>🌟 Main Site Character</h1>

            <div class="aicpp-info">
                <strong>💡 What is this?</strong> The Main Character is your site's default AI assistant — like ChatGPT's main chat. Every registered user can chat with this character directly. It is <strong>separate</strong> from the personas in the sidebar. Think of it as the "home page" assistant.
            </div>

            <form method="post"><?php wp_nonce_field('aicpp_main_char'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">⚡</span> Status</h2>
                    <p><label><input type="checkbox" name="enabled" <?php checked($enabled); ?>> <strong>Enable Main Site Character</strong></label></p>
                    <p><?php echo $enabled ? '<span class="aicpp-on">✅ ACTIVE</span>' : '<span class="aicpp-off">❌ INACTIVE</span>'; ?></p>
                    <p class="description">When enabled, all users see this character as the default chat experience. When disabled, users must select a persona from the sidebar to start chatting.</p>
                </div>

                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🎨</span> Character Identity</h2>
                    <table class="form-table">
                        <tr><th>📝 Name</th><td><input type="text" name="name" value="<?php echo esc_attr($name); ?>" class="regular-text" required></td></tr>
                        <tr><th>📄 Description</th><td><textarea name="description" rows="2" class="large-text"><?php echo esc_textarea($description); ?></textarea></td></tr>
                        <tr><th>🖼️ Avatar</th><td>
                            <div style="display:flex;gap:15px;align-items:center">
                                <div>
                                    <label style="font-size:12px">Initials (2-4 chars)</label><br>
                                    <input type="text" name="avatar_initials" value="<?php echo esc_attr($initials); ?>" maxlength="4" style="width:80px" id="main-avatar-initials">
                                </div>
                                <div>
                                    <label style="font-size:12px">Color</label><br>
                                    <input type="color" name="avatar_color" value="<?php echo esc_attr($color); ?>" style="width:60px;height:36px;border:none;cursor:pointer" id="main-avatar-color">
                                </div>
                                <div id="main-avatar-preview" style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;background:<?php echo esc_attr($color); ?>"><?php echo esc_html(mb_strtoupper(mb_substr($initials, 0, 2))); ?></div>
                            </div>
                        </td></tr>
                    </table>
                </div>

                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🤖</span> System Prompt</h2>
                    <p class="description">This is the personality and instructions for your main character. It defines how it behaves when chatting with any user.</p>
                    <div class="aicpp-code"><textarea name="system_prompt" rows="12"><?php echo esc_textarea($prompt); ?></textarea></div>
                </div>

                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">⚙️</span> Model Settings</h2>
                    <table class="form-table">
                        <tr><th>🧠 Model</th><td>
                            <select name="model">
                                <optgroup label="OpenAI">
                                    <option value="gpt-4o" <?php selected($model, 'gpt-4o'); ?>>GPT-4o</option>
                                    <option value="gpt-4o-mini" <?php selected($model, 'gpt-4o-mini'); ?>>GPT-4o Mini</option>
                                    <option value="gpt-4-turbo" <?php selected($model, 'gpt-4-turbo'); ?>>GPT-4 Turbo</option>
                                    <option value="gpt-4" <?php selected($model, 'gpt-4'); ?>>GPT-4</option>
                                    <option value="gpt-3.5-turbo" <?php selected($model, 'gpt-3.5-turbo'); ?>>GPT-3.5 Turbo</option>
                                </optgroup>
                                <optgroup label="Anthropic (Claude)">
                                    <option value="claude-sonnet-4-20250514" <?php selected($model, 'claude-sonnet-4-20250514'); ?>>Claude Sonnet 4</option>
                                    <option value="claude-3-5-sonnet-20241022" <?php selected($model, 'claude-3-5-sonnet-20241022'); ?>>Claude 3.5 Sonnet</option>
                                    <option value="claude-3-opus-20240229" <?php selected($model, 'claude-3-opus-20240229'); ?>>Claude 3 Opus</option>
                                </optgroup>
                                <optgroup label="Google (Gemini)">
                                    <option value="gemini-1.5-pro-latest" <?php selected($model, 'gemini-1.5-pro-latest'); ?>>Gemini 1.5 Pro</option>
                                    <option value="gemini-1.5-flash-latest" <?php selected($model, 'gemini-1.5-flash-latest'); ?>>Gemini 1.5 Flash</option>
                                </optgroup>
                                <optgroup label="DeepSeek">
                                    <option value="deepseek-chat" <?php selected($model, 'deepseek-chat'); ?>>DeepSeek Chat</option>
                                    <option value="deepseek-reasoner" <?php selected($model, 'deepseek-reasoner'); ?>>DeepSeek Reasoner</option>
                                </optgroup>
                                <optgroup label="Mistral AI">
                                    <option value="mistral-large-latest" <?php selected($model, 'mistral-large-latest'); ?>>Mistral Large</option>
                                    <option value="mistral-small-latest" <?php selected($model, 'mistral-small-latest'); ?>>Mistral Small</option>
                                </optgroup>
                                <optgroup label="Groq">
                                    <option value="llama-3.1-405b-reasoning" <?php selected($model, 'llama-3.1-405b-reasoning'); ?>>Llama 3.1 405B</option>
                                    <option value="llama-3.1-70b-versatile" <?php selected($model, 'llama-3.1-70b-versatile'); ?>>Llama 3.1 70B</option>
                                </optgroup>
                            </select>
                        </td></tr>
                        <tr><th>🌡️ Temperature</th><td><input type="number" name="temperature" value="<?php echo esc_attr($temperature); ?>" min="0" max="2" step="0.1" style="width:100px"></td></tr>
                        <tr><th>📊 Max Tokens</th><td><input type="number" name="max_tokens" value="<?php echo esc_attr($max_tokens); ?>" min="1" max="128000" style="width:150px"></td></tr>
                    </table>
                </div>

                <p><input type="submit" name="save_main_char" class="button button-primary button-large" value="💾 Save Main Character"></p>
            </form>
        </div>
        <script>
        (function(){
            var initials = document.getElementById('main-avatar-initials');
            var color = document.getElementById('main-avatar-color');
            var preview = document.getElementById('main-avatar-preview');
            function update() {
                preview.textContent = (initials.value || 'AI').substring(0,2).toUpperCase();
                preview.style.background = color.value || '#667eea';
            }
            initials.addEventListener('input', update);
            color.addEventListener('input', update);
        })();
        </script>
        <?php
    }

    // ===================== PERSONAS PAGE =====================
    public function page_personas() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        global $wpdb;
        $list = $wpdb->get_results("SELECT p.*, (SELECT COUNT(*) FROM {$this->table_persona_assignments} pa WHERE pa.persona_id = p.id) as client_count FROM {$this->table_personas} p ORDER BY p.id DESC");
        ?>
        <div class="wrap aicpp-wrap">
            <h1>🎭 Character Personas</h1>

            <div class="aicpp-info">
                <strong>📋 Visibility System:</strong><br>
                🌍 <strong>Public</strong> = Visible to ALL registered users in the sidebar Persona section.<br>
                🔒 <strong>Private</strong> = Only visible to specifically assigned clients (linked to their username). Use the "Assign Clients" button for private personas.
            </div>

            <div class="aicpp-card">
                <button class="button button-primary button-large" onclick="aicppOpenModal()">➕ Create New Persona</button>
            </div>

            <div class="aicpp-personas">
                <?php foreach ($list as $p): ?>
                <div class="aicpp-pcard">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <h3 style="margin:0"><?php echo esc_html($p->name); ?></h3>
                        <div>
                            <?php if ($p->visibility === 'public'): ?>
                                <span class="aicpp-badge-blue">🌍 Public</span>
                            <?php else: ?>
                                <span class="aicpp-badge-orange">🔒 Private</span>
                                <span class="aicpp-badge-green"><?php echo (int)$p->client_count; ?> client<?php echo $p->client_count != 1 ? 's' : ''; ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <p style="color:#666;font-size:14px"><?php echo esc_html($p->description); ?></p>
                    <p style="font-size:13px;color:#888">
                        <strong>Model:</strong> <?php echo esc_html($p->model); ?> |
                        <strong>Temp:</strong> <?php echo esc_html($p->temperature); ?>
                    </p>
                    <?php if ($p->visibility === 'private'):
                        $assigned = $wpdb->get_results($wpdb->prepare(
                            "SELECT u.display_name, u.user_login FROM {$this->table_persona_assignments} pa
                             JOIN {$wpdb->users} u ON pa.user_id = u.ID
                             WHERE pa.persona_id = %d LIMIT 5", $p->id
                        ));
                        if ($assigned): ?>
                        <div style="margin-top:10px">
                            <strong style="font-size:12px;color:#495057">👤 Assigned to:</strong>
                            <div class="aicpp-persona-tags" style="margin-top:5px">
                                <?php foreach ($assigned as $a): ?>
                                    <span class="aicpp-badge"><?php echo esc_html($a->display_name ?: $a->user_login); ?></span>
                                <?php endforeach; ?>
                                <?php if ($p->client_count > 5): ?>
                                    <span class="aicpp-badge-orange">+<?php echo ($p->client_count - 5); ?> more</span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php endif;
                    endif; ?>
                    <div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap">
                        <button class="button" onclick="aicppEditPersona(<?php echo (int)$p->id; ?>)">✏️ Edit</button>
                        <?php if ($p->visibility === 'private'): ?>
                            <button class="button" onclick="aicppManageAssignments(<?php echo (int)$p->id; ?>, '<?php echo esc_js($p->name); ?>')" style="color:#228be6">👤 Assign Clients</button>
                        <?php endif; ?>
                        <button class="button" onclick="aicppDeletePersona(<?php echo (int)$p->id; ?>)" style="color:#c92a2a">🗑️ Delete</button>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <!-- Create/Edit Persona Modal -->
            <div id="pmodal" class="aicpp-modal">
                <div class="aicpp-mbox">
                    <span class="aicpp-close" onclick="aicppCloseModal()">&times;</span>
                    <h2 id="mtitle">🎭 Create Persona</h2>
                    <form id="pform">
                        <input type="hidden" name="pid" id="pid">
                        <table class="form-table">
                            <tr><th>📝 Name *</th><td><input type="text" id="pname" class="regular-text" required></td></tr>
                            <tr><th>📄 Description</th><td><textarea id="pdesc" rows="2" class="large-text"></textarea></td></tr>
                            <tr><th>🖼️ Avatar</th><td>
                                <div style="display:flex;gap:15px;align-items:center">
                                    <div><label style="font-size:12px">Initials</label><br><input type="text" id="pavatar_initials" maxlength="4" style="width:80px" placeholder="DM"></div>
                                    <div><label style="font-size:12px">Color</label><br><input type="color" id="pavatar_color" value="#667eea" style="width:60px;height:36px;border:none;cursor:pointer"></div>
                                    <div id="pavatar_preview" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;background:#667eea">DM</div>
                                </div>
                            </td></tr>
                            <tr><th>🤖 System Prompt *</th><td><textarea id="pprompt" rows="5" class="large-text code" required></textarea></td></tr>
                            <tr><th>🧠 EI Code</th><td><div class="aicpp-code"><textarea id="pei" rows="4"></textarea></div></td></tr>
                            <tr><th>🏆 Rewards Code</th><td><div class="aicpp-code"><textarea id="prewards" rows="4"></textarea></div></td></tr>
                            <tr><th>🔧 Global Overrides</th><td>
                                <label><input type="checkbox" id="puse_global_ei"> Use Global EI (when persona EI is empty)</label><br>
                                <label><input type="checkbox" id="puse_global_rewards"> Use Global Rewards (when persona rewards is empty)</label>
                            </td></tr>
                            <tr><th>👁️ Visibility *</th><td>
                                <select id="pvisibility" onchange="aicppToggleVisibility()">
                                    <option value="public">🌍 Public — All registered users can see this persona</option>
                                    <option value="private">🔒 Private — Only assigned clients can see this persona</option>
                                </select>
                                <p class="description" id="visibility-hint-public">This persona will appear for every registered user in their sidebar Persona section.</p>
                                <p class="description" id="visibility-hint-private" style="display:none">This persona will only appear for clients you specifically assign below. Link it to their username/account.</p>
                            </td></tr>
                            <tr><th>🧠 Model</th><td>
                                <select id="pmodel">
                                    <optgroup label="OpenAI">
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                        <option value="gpt-4">GPT-4</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        <option value="o1-preview">O1 Preview</option>
                                        <option value="o1-mini">O1 Mini</option>
                                    </optgroup>
                                    <optgroup label="Anthropic (Claude)">
                                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                                    </optgroup>
                                    <optgroup label="Google (Gemini)">
                                        <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro</option>
                                        <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash</option>
                                        <option value="gemini-pro">Gemini Pro</option>
                                    </optgroup>
                                    <optgroup label="DeepSeek">
                                        <option value="deepseek-chat">DeepSeek Chat</option>
                                        <option value="deepseek-coder">DeepSeek Coder</option>
                                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                                    </optgroup>
                                    <optgroup label="Mistral AI">
                                        <option value="mistral-large-latest">Mistral Large</option>
                                        <option value="mistral-small-latest">Mistral Small</option>
                                        <option value="open-mixtral-8x22b">Mixtral 8x22B</option>
                                    </optgroup>
                                    <optgroup label="Groq">
                                        <option value="llama-3.1-405b-reasoning">Llama 3.1 405B</option>
                                        <option value="llama-3.1-70b-versatile">Llama 3.1 70B</option>
                                        <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                                        <option value="gemma2-9b-it">Gemma 2 9B</option>
                                    </optgroup>
                                    <optgroup label="OpenRouter">
                                        <option value="openrouter/auto">Auto (Best)</option>
                                        <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (OR)</option>
                                        <option value="openrouter/openai/gpt-4o">GPT-4o (OR)</option>
                                    </optgroup>
                                </select>
                            </td></tr>
                            <tr><th>🌡️ Temperature</th><td><input type="number" id="ptemp" value="0.7" min="0" max="2" step="0.1"></td></tr>
                            <tr><th>📊 Max Tokens</th><td><input type="number" id="ptokens" value="2000" min="1" max="128000"></td></tr>
                        </table>

                        <!-- Inline Client Assignment (only for private personas) -->
                        <div class="aicpp-assign-section" id="assign-section" style="display:none">
                            <h3>👤 Assign to Clients</h3>
                            <p class="description">Search for registered users by name, email, or username and link this persona to their account.</p>
                            <div class="aicpp-user-search">
                                <input type="text" id="user-search-input" placeholder="Search by username, email, or display name...">
                                <button type="button" onclick="aicppSearchUsers()">🔍 Search</button>
                            </div>
                            <div id="user-search-results" class="aicpp-user-results" style="display:none"></div>
                            <div class="aicpp-assigned-list">
                                <h4>✅ Currently Assigned Clients</h4>
                                <div id="assigned-users-list"><div class="aicpp-empty">No clients assigned yet</div></div>
                            </div>
                        </div>

                        <p style="margin-top:20px">
                            <button type="submit" class="button button-primary button-large">💾 Save Persona</button>
                            <button type="button" class="button" onclick="aicppCloseModal()">Cancel</button>
                        </p>
                    </form>
                </div>
            </div>

            <!-- Quick Assignment Modal -->
            <div id="assign-modal" class="aicpp-modal">
                <div class="aicpp-mbox" style="max-width:600px">
                    <span class="aicpp-close" onclick="aicppCloseAssignModal()">&times;</span>
                    <h2 id="assign-modal-title">👤 Assign Clients</h2>
                    <div class="aicpp-user-search">
                        <input type="text" id="quick-search-input" placeholder="Search by username, email, or display name...">
                        <button type="button" onclick="aicppQuickSearch()">🔍 Search</button>
                    </div>
                    <div id="quick-search-results" class="aicpp-user-results" style="display:none"></div>
                    <div class="aicpp-assigned-list">
                        <h4>✅ Assigned Clients</h4>
                        <div id="quick-assigned-list"><div class="aicpp-empty">Loading...</div></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
        (function(){
            var ajaxurl = <?php echo wp_json_encode(admin_url('admin-ajax.php')); ?>;
            var nonce = <?php echo wp_json_encode(wp_create_nonce('aicpp')); ?>;
            var currentPersonaId = null;
            var quickPersonaId = null;

            function updateAvatarPreview() {
                var initials = document.getElementById('pavatar_initials').value || 'AI';
                var color = document.getElementById('pavatar_color').value || '#667eea';
                var preview = document.getElementById('pavatar_preview');
                preview.textContent = initials.substring(0, 2).toUpperCase();
                preview.style.background = color;
            }
            document.getElementById('pavatar_initials').addEventListener('input', updateAvatarPreview);
            document.getElementById('pavatar_color').addEventListener('input', updateAvatarPreview);

            window.aicppToggleVisibility = function() {
                var vis = document.getElementById('pvisibility').value;
                var pid = document.getElementById('pid').value;
                document.getElementById('visibility-hint-public').style.display = vis === 'public' ? '' : 'none';
                document.getElementById('visibility-hint-private').style.display = vis === 'private' ? '' : 'none';
                // Only show assign section for private + saved persona
                if (vis === 'private' && pid) {
                    document.getElementById('assign-section').style.display = 'block';
                } else if (vis === 'private' && !pid) {
                    document.getElementById('assign-section').style.display = 'block';
                    document.getElementById('assigned-users-list').innerHTML = '<div class="aicpp-empty">Save the persona first, then assign clients</div>';
                } else {
                    document.getElementById('assign-section').style.display = 'none';
                }
            };

            window.aicppOpenModal = function(){
                document.getElementById('pid').value = '';
                document.getElementById('pform').reset();
                document.getElementById('mtitle').textContent = '🎭 Create Persona';
                document.getElementById('pvisibility').value = 'public';
                document.getElementById('assign-section').style.display = 'none';
                document.getElementById('user-search-results').style.display = 'none';
                document.getElementById('visibility-hint-public').style.display = '';
                document.getElementById('visibility-hint-private').style.display = 'none';
                updateAvatarPreview();
                document.getElementById('pmodal').style.display = 'flex';
            };

            window.aicppCloseModal = function(){ document.getElementById('pmodal').style.display = 'none'; };

            window.aicppEditPersona = function(id){
                document.getElementById('mtitle').textContent = '✏️ Edit Persona';
                currentPersonaId = id;
                var fd = new FormData();
                fd.append('action', 'aicpp_get_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', id);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) {
                        var p = d.data;
                        document.getElementById('pid').value = p.id;
                        document.getElementById('pname').value = p.name;
                        document.getElementById('pdesc').value = p.description || '';
                        document.getElementById('pavatar_initials').value = p.avatar_initials || '';
                        document.getElementById('pavatar_color').value = p.avatar_color || '#667eea';
                        document.getElementById('pprompt').value = p.system_prompt;
                        document.getElementById('pei').value = p.emotional_intelligence_code || '';
                        document.getElementById('prewards').value = p.rewards_code || '';
                        document.getElementById('puse_global_ei').checked = (p.use_global_ei == 1);
                        document.getElementById('puse_global_rewards').checked = (p.use_global_rewards == 1);
                        document.getElementById('pvisibility').value = p.visibility || 'private';
                        document.getElementById('pmodel').value = p.model;
                        document.getElementById('ptemp').value = p.temperature;
                        document.getElementById('ptokens').value = p.max_tokens;
                        aicppToggleVisibility();
                        updateAvatarPreview();
                        if (p.visibility === 'private') loadAssignedUsers(id);
                        document.getElementById('pmodal').style.display = 'flex';
                    }
                });
            };

            window.aicppDeletePersona = function(id){
                if (!confirm('Delete this persona and all its client assignments?')) return;
                var fd = new FormData();
                fd.append('action', 'aicpp_delete_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', id);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) location.reload();
                    else alert(d.data.message);
                });
            };

            window.aicppSearchUsers = function(){
                var query = document.getElementById('user-search-input').value.trim();
                if (query.length < 2) { alert('Enter at least 2 characters'); return; }
                var fd = new FormData();
                fd.append('action', 'aicpp_search_users');
                fd.append('nonce', nonce);
                fd.append('query', query);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    var container = document.getElementById('user-search-results');
                    container.style.display = 'block';
                    if (d.success && d.data.users.length > 0) {
                        container.innerHTML = d.data.users.map(function(u){
                            return '<div class="aicpp-user-row"><div class="user-info"><span class="user-name">' + escapeHtml(u.display_name) + '</span><span class="user-email">' + escapeHtml(u.user_email) + '</span><span class="user-login">@' + escapeHtml(u.user_login) + '</span></div><button type="button" class="btn-assign" onclick="aicppAssignUser(' + u.ID + ')">➕ Assign</button></div>';
                        }).join('');
                    } else {
                        container.innerHTML = '<div class="aicpp-empty">No users found</div>';
                    }
                });
            };

            window.aicppAssignUser = function(userId){
                var personaId = document.getElementById('pid').value;
                if (!personaId) { alert('Please save the persona first.'); return; }
                var fd = new FormData();
                fd.append('action', 'aicpp_assign_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', personaId);
                fd.append('user_id', userId);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) {
                        loadAssignedUsers(personaId);
                        document.getElementById('user-search-results').style.display = 'none';
                        document.getElementById('user-search-input').value = '';
                    } else {
                        alert(d.data.message || 'Error');
                    }
                });
            };

            function loadAssignedUsers(personaId) {
                var fd = new FormData();
                fd.append('action', 'aicpp_get_persona_users');
                fd.append('nonce', nonce);
                fd.append('persona_id', personaId);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    var container = document.getElementById('assigned-users-list');
                    if (d.success && d.data.users.length > 0) {
                        container.innerHTML = '<div class="aicpp-user-results">' + d.data.users.map(function(u){
                            return '<div class="aicpp-user-row"><div class="user-info"><span class="user-name">' + escapeHtml(u.display_name) + '</span><span class="user-email">' + escapeHtml(u.user_email) + '</span><span class="user-login">@' + escapeHtml(u.user_login) + '</span></div><button type="button" class="btn-remove" onclick="aicppUnassignUser(' + personaId + ', ' + u.ID + ')">❌ Remove</button></div>';
                        }).join('') + '</div>';
                    } else {
                        container.innerHTML = '<div class="aicpp-empty">No clients assigned yet</div>';
                    }
                });
            }

            window.aicppUnassignUser = function(personaId, userId){
                if (!confirm('Remove this client from this persona?')) return;
                var fd = new FormData();
                fd.append('action', 'aicpp_unassign_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', personaId);
                fd.append('user_id', userId);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) {
                        var pid = document.getElementById('pid').value;
                        if (pid) loadAssignedUsers(pid);
                        if (quickPersonaId) loadQuickAssigned(quickPersonaId);
                    }
                });
            };

            window.aicppManageAssignments = function(id, name){
                quickPersonaId = id;
                document.getElementById('assign-modal-title').textContent = '👤 Assign Clients to: ' + name;
                document.getElementById('quick-search-results').style.display = 'none';
                document.getElementById('quick-search-input').value = '';
                loadQuickAssigned(id);
                document.getElementById('assign-modal').style.display = 'flex';
            };
            window.aicppCloseAssignModal = function(){ document.getElementById('assign-modal').style.display = 'none'; quickPersonaId = null; };

            window.aicppQuickSearch = function(){
                var query = document.getElementById('quick-search-input').value.trim();
                if (query.length < 2) { alert('Enter at least 2 characters'); return; }
                var fd = new FormData();
                fd.append('action', 'aicpp_search_users');
                fd.append('nonce', nonce);
                fd.append('query', query);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    var container = document.getElementById('quick-search-results');
                    container.style.display = 'block';
                    if (d.success && d.data.users.length > 0) {
                        container.innerHTML = d.data.users.map(function(u){
                            return '<div class="aicpp-user-row"><div class="user-info"><span class="user-name">' + escapeHtml(u.display_name) + '</span><span class="user-email">' + escapeHtml(u.user_email) + '</span><span class="user-login">@' + escapeHtml(u.user_login) + '</span></div><button type="button" class="btn-assign" onclick="aicppQuickAssign(' + u.ID + ')">➕ Assign</button></div>';
                        }).join('');
                    } else {
                        container.innerHTML = '<div class="aicpp-empty">No users found</div>';
                    }
                });
            };

            window.aicppQuickAssign = function(userId){
                if (!quickPersonaId) return;
                var fd = new FormData();
                fd.append('action', 'aicpp_assign_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', quickPersonaId);
                fd.append('user_id', userId);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) {
                        loadQuickAssigned(quickPersonaId);
                        document.getElementById('quick-search-results').style.display = 'none';
                        document.getElementById('quick-search-input').value = '';
                    } else {
                        alert(d.data.message || 'Error');
                    }
                });
            };

            function loadQuickAssigned(personaId) {
                var fd = new FormData();
                fd.append('action', 'aicpp_get_persona_users');
                fd.append('nonce', nonce);
                fd.append('persona_id', personaId);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    var container = document.getElementById('quick-assigned-list');
                    if (d.success && d.data.users.length > 0) {
                        container.innerHTML = '<div class="aicpp-user-results">' + d.data.users.map(function(u){
                            return '<div class="aicpp-user-row"><div class="user-info"><span class="user-name">' + escapeHtml(u.display_name) + '</span><span class="user-email">' + escapeHtml(u.user_email) + '</span><span class="user-login">@' + escapeHtml(u.user_login) + '</span></div><button type="button" class="btn-remove" onclick="aicppUnassignUser(' + personaId + ', ' + u.ID + ')">❌ Remove</button></div>';
                        }).join('') + '</div>';
                    } else {
                        container.innerHTML = '<div class="aicpp-empty">No clients assigned</div>';
                    }
                });
            }

            document.getElementById('pform').onsubmit = function(e){
                e.preventDefault();
                var fd = new FormData();
                fd.append('action', 'aicpp_save_persona');
                fd.append('nonce', nonce);
                fd.append('persona_id', document.getElementById('pid').value);
                fd.append('name', document.getElementById('pname').value);
                fd.append('description', document.getElementById('pdesc').value);
                fd.append('avatar_initials', document.getElementById('pavatar_initials').value);
                fd.append('avatar_color', document.getElementById('pavatar_color').value);
                fd.append('system_prompt', document.getElementById('pprompt').value);
                fd.append('emotional_intelligence_code', document.getElementById('pei').value);
                fd.append('rewards_code', document.getElementById('prewards').value);
                fd.append('use_global_ei', document.getElementById('puse_global_ei').checked ? '1' : '0');
                fd.append('use_global_rewards', document.getElementById('puse_global_rewards').checked ? '1' : '0');
                fd.append('visibility', document.getElementById('pvisibility').value);
                fd.append('model', document.getElementById('pmodel').value);
                fd.append('temperature', document.getElementById('ptemp').value);
                fd.append('max_tokens', document.getElementById('ptokens').value);
                fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){
                    if (d.success) {
                        if (!document.getElementById('pid').value && d.data.persona_id) {
                            document.getElementById('pid').value = d.data.persona_id;
                            aicppToggleVisibility();
                            alert('Persona saved! You can now assign clients if this is a private persona.');
                        } else {
                            alert('Saved!');
                            location.reload();
                        }
                    } else {
                        alert(d.data.message || 'Error');
                    }
                });
            };

            document.getElementById('pmodal').onclick = function(e){ if (e.target === this) aicppCloseModal(); };
            document.getElementById('assign-modal').onclick = function(e){ if (e.target === this) aicppCloseAssignModal(); };
            document.getElementById('user-search-input').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); aicppSearchUsers(); }});
            document.getElementById('quick-search-input').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); aicppQuickSearch(); }});

            function escapeHtml(text) {
                var div = document.createElement('div');
                div.textContent = text || '';
                return div.innerHTML;
            }
        })();
        </script>
        <?php
    }

    // ===================== CHARACTER BINDING =====================
    public function page_binding() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        if (isset($_POST['save_binding']) && check_admin_referer('aicpp_binding')) {
            update_option('aicpp_active_character_code', wp_kses_post($_POST['code']));
            update_option('aicpp_character_binding_active', isset($_POST['active']) ? '1' : '0');
            echo '<div class="notice notice-success"><p>✅ Saved!</p></div>';
        }
        $code   = get_option('aicpp_active_character_code', '');
        $active = get_option('aicpp_character_binding_active', '0') === '1';
        ?>
        <div class="wrap aicpp-wrap">
            <h1>🔗 Character Binding System</h1>
            <div class="aicpp-info"><strong>💡 How it works:</strong> Paste character code below to override ALL personas with a single character personality.</div>
            <form method="post"><?php wp_nonce_field('aicpp_binding'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">⚡</span> Status</h2>
                    <p><label><input type="checkbox" name="active" <?php checked($active); ?>> <strong>Enable Character Binding</strong></label></p>
                    <p><?php echo $active ? '<span class="aicpp-on">✅ ACTIVE</span>' : '<span class="aicpp-off">❌ INACTIVE</span>'; ?></p>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">📝</span> Character Code</h2>
                    <div class="aicpp-code"><textarea name="code" rows="20" placeholder="Paste character code here..."><?php echo esc_textarea($code); ?></textarea></div>
                </div>
                <p><input type="submit" name="save_binding" class="button button-primary button-large" value="💾 Save"></p>
            </form>
        </div>
        <?php
    }

    // ===================== EMOTIONAL INTELLIGENCE =====================
    public function page_ei() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        if (isset($_POST['save_ei']) && check_admin_referer('aicpp_ei')) {
            update_option('aicpp_global_ei_code', wp_kses_post($_POST['code']));
            update_option('aicpp_global_ei_enabled', isset($_POST['enabled']) ? '1' : '0');
            echo '<div class="notice notice-success"><p>✅ Saved!</p></div>';
        }
        $code    = get_option('aicpp_global_ei_code', '');
        $enabled = get_option('aicpp_global_ei_enabled', '0') === '1';
        ?>
        <div class="wrap aicpp-wrap">
            <h1>🧠 Emotional Intelligence System</h1>
            <form method="post"><?php wp_nonce_field('aicpp_ei'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">⚡</span> Global EI Settings</h2>
                    <p><label><input type="checkbox" name="enabled" <?php checked($enabled); ?>> <strong>Enable Global Emotional Intelligence</strong></label></p>
                    <p><?php echo $enabled ? '<span class="aicpp-on">✅ ACTIVE</span>' : '<span class="aicpp-off">❌ INACTIVE</span>'; ?></p>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">📝</span> EI Code</h2>
                    <div class="aicpp-code"><textarea name="code" rows="18"><?php echo esc_textarea($code); ?></textarea></div>
                </div>
                <p><input type="submit" name="save_ei" class="button button-primary button-large" value="💾 Save"></p>
            </form>
        </div>
        <?php
    }

    // ===================== REWARDS SYSTEM =====================
    public function page_rewards() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        if (isset($_POST['save_rewards']) && check_admin_referer('aicpp_rewards')) {
            update_option('aicpp_global_rewards_code', wp_kses_post($_POST['code']));
            update_option('aicpp_global_rewards_enabled', isset($_POST['enabled']) ? '1' : '0');
            echo '<div class="notice notice-success"><p>✅ Saved!</p></div>';
        }
        $code    = get_option('aicpp_global_rewards_code', '');
        $enabled = get_option('aicpp_global_rewards_enabled', '0') === '1';
        ?>
        <div class="wrap aicpp-wrap">
            <h1>🏆 Rewards System</h1>
            <form method="post"><?php wp_nonce_field('aicpp_rewards'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">⚡</span> Global Rewards Settings</h2>
                    <p><label><input type="checkbox" name="enabled" <?php checked($enabled); ?>> <strong>Enable Global Rewards System</strong></label></p>
                    <p><?php echo $enabled ? '<span class="aicpp-on">✅ ACTIVE</span>' : '<span class="aicpp-off">❌ INACTIVE</span>'; ?></p>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">📝</span> Rewards Code</h2>
                    <div class="aicpp-code"><textarea name="code" rows="18"><?php echo esc_textarea($code); ?></textarea></div>
                </div>
                <p><input type="submit" name="save_rewards" class="button button-primary button-large" value="💾 Save"></p>
            </form>
        </div>
        <?php
    }

    // ===================== HIDDEN INJECTION =====================
    public function page_injection() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        if (isset($_POST['save_inj']) && check_admin_referer('aicpp_inj')) {
            update_option('aicpp_injection_enabled', isset($_POST['enabled']) ? '1' : '0');
            for ($i = 1; $i <= 5; $i++) {
                update_option("aicpp_slot{$i}_enabled", isset($_POST["s{$i}"]) ? '1' : '0');
                update_option("aicpp_hidden_message_{$i}", sanitize_textarea_field($_POST["msg{$i}"]));
            }
            echo '<div class="notice notice-success"><p>✅ All 5 slots saved!</p></div>';
        }
        $enabled = get_option('aicpp_injection_enabled', '0') === '1';
        $slots = []; $messages = [];
        for ($i = 1; $i <= 5; $i++) {
            $slots[$i]    = get_option("aicpp_slot{$i}_enabled", '1') === '1';
            $messages[$i] = get_option("aicpp_hidden_message_{$i}", '');
        }
        $slot_config = [
            1 => ['color'=>'#228be6','name'=>'THE EXPLORER','desc'=>'Q1, Q6, Q11... — Maze Building','emoji'=>'🔵'],
            2 => ['color'=>'#40c057','name'=>'THE CONNECTOR','desc'=>'Q2, Q7, Q12... — Bridge Finding','emoji'=>'🟢'],
            3 => ['color'=>'#fab005','name'=>'THE PREDICTOR','desc'=>'Q3, Q8, Q13... — Chain Activation','emoji'=>'🟡'],
            4 => ['color'=>'#fd7e14','name'=>'THE CORRECTOR','desc'=>'Q4, Q9, Q14... — Correction & Learning','emoji'=>'🟠'],
            5 => ['color'=>'#e64980','name'=>'THE META-ANALYST','desc'=>'Q5, Q10, Q15... — Deep Patterns','emoji'=>'🔴'],
        ];
        ?>
        <div class="wrap aicpp-wrap">
            <h1>💉 Hidden Injection — 5-Slot Cognitive System</h1>

            <div class="aicpp-info">
                <strong>🧠 Living Prediction Network Architecture:</strong>
                Each slot is a specialized cognitive function. Together they form a predictive mind that anticipates customer questions.
            </div>

            <div class="aicpp-flow" style="background:#f8f9fa;border-radius:10px;padding:15px;margin:20px 0">
                <?php foreach ($slot_config as $num => $cfg): ?>
                    <div class="aicpp-flow-item" style="background:<?php echo esc_attr($cfg['color']); ?>;color:#fff"><?php echo $cfg['emoji']; ?> <?php echo esc_html($cfg['name']); ?></div>
                    <?php if ($num < 5): ?><span class="aicpp-flow-arrow">&rarr;</span><?php endif; ?>
                <?php endforeach; ?>
            </div>

            <form method="post"><?php wp_nonce_field('aicpp_inj'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🎮</span> Master Control</h2>
                    <p><label><input type="checkbox" name="enabled" <?php checked($enabled); ?>> <strong>Enable 5-Slot Living Prediction Network</strong></label></p>
                    <p><?php echo $enabled ? '<span class="aicpp-on">✅ SYSTEM ACTIVE</span>' : '<span class="aicpp-off">❌ SYSTEM INACTIVE</span>'; ?></p>
                </div>
                <div class="aicpp-grid-5">
                    <?php foreach ($slot_config as $num => $cfg): ?>
                    <div class="aicpp-slot s<?php echo $num; ?>">
                        <h3 style="color:<?php echo esc_attr($cfg['color']); ?>"><?php echo $cfg['emoji']; ?> Slot <?php echo $num; ?></h3>
                        <p style="font-weight:600;font-size:13px;margin:0 0 5px"><?php echo esc_html($cfg['name']); ?></p>
                        <p style="font-size:11px;color:#888;margin:0 0 10px"><?php echo esc_html($cfg['desc']); ?></p>
                        <p><label style="font-size:12px"><input type="checkbox" name="s<?php echo $num; ?>" <?php checked($slots[$num]); ?>> ✅ Enable</label></p>
                        <textarea name="msg<?php echo $num; ?>" placeholder="Paste <?php echo esc_attr($cfg['name']); ?> protocol code here..."><?php echo esc_textarea($messages[$num]); ?></textarea>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div class="aicpp-card" style="margin-top:20px">
                    <h2><span class="aicpp-section-icon">🏷️</span> Available Tags</h2>
                    <p>
                        <code>{user_name}</code> — Customer's name or 'Friend'<br>
                        <code>{time_of_day}</code> — morning, afternoon, evening, night<br>
                        <code>{date}</code> — Today's date<br>
                        <code>{slot_number}</code> — Current slot number (1-5)<br>
                        <code>{question_number}</code> — Customer's question count
                    </p>
                    <p><input type="submit" name="save_inj" class="button button-primary button-large" value="💾 Save All Slots"></p>
                </div>
            </form>
        </div>
        <?php
    }

    // ===================== SETTINGS =====================
    public function page_settings() {
        if (!current_user_can('manage_options')) wp_die('Access denied');
        if (isset($_POST['save_set']) && check_admin_referer('aicpp_set')) {
            update_option('aicpp_api_provider', sanitize_text_field($_POST['provider']));
            update_option('aicpp_max_message_length', max(100, min(100000, intval($_POST['max_message_length'] ?? 10000))));
            update_option('aicpp_require_login', isset($_POST['require_login']) ? '1' : '0');
            update_option('aicpp_login_message', sanitize_textarea_field($_POST['login_message'] ?? ''));
            $provider_keys = ['openai', 'anthropic', 'google', 'deepseek', 'openrouter', 'mistral', 'groq'];
            foreach ($provider_keys as $pk) {
                $raw = sanitize_text_field($_POST["{$pk}_key"] ?? '');
                if (!empty($raw) && substr($raw, 0, 4) !== '****') {
                    update_option("aicpp_{$pk}_api_key", $this->encrypt_api_key($raw));
                } elseif (empty($raw)) {
                    update_option("aicpp_{$pk}_api_key", '');
                }
            }
            echo '<div class="notice notice-success"><p>✅ Settings saved!</p></div>';
        }
        $provider = get_option('aicpp_api_provider', 'openai');
        $max_len  = get_option('aicpp_max_message_length', '10000');
        $require_login = get_option('aicpp_require_login', '1') === '1';
        $login_message = get_option('aicpp_login_message', 'Please sign in to access your AI assistant.');

        $keys = [];
        $provider_list = ['openai', 'anthropic', 'google', 'deepseek', 'openrouter', 'mistral', 'groq'];
        foreach ($provider_list as $pk) {
            $decrypted = $this->get_api_key($pk);
            $keys[$pk] = !empty($decrypted) ? '****' . substr($decrypted, -4) : '';
        }

        $providers = [
            'openai'     => ['name'=>'OpenAI','icon'=>'🟢','url'=>'https://platform.openai.com/api-keys','placeholder'=>'sk-...'],
            'anthropic'  => ['name'=>'Anthropic (Claude)','icon'=>'🟠','url'=>'https://console.anthropic.com/settings/keys','placeholder'=>'sk-ant-...'],
            'google'     => ['name'=>'Google (Gemini)','icon'=>'🔵','url'=>'https://makersuite.google.com/app/apikey','placeholder'=>'AIza...'],
            'deepseek'   => ['name'=>'DeepSeek','icon'=>'💎','url'=>'https://platform.deepseek.com/api_keys','placeholder'=>'sk-...'],
            'openrouter' => ['name'=>'OpenRouter','icon'=>'🌐','url'=>'https://openrouter.ai/keys','placeholder'=>'sk-or-...'],
            'mistral'    => ['name'=>'Mistral AI','icon'=>'🟠','url'=>'https://console.mistral.ai/api-keys/','placeholder'=>'...'],
            'groq'       => ['name'=>'Groq','icon'=>'⚡','url'=>'https://console.groq.com/keys','placeholder'=>'gsk_...'],
        ];
        ?>
        <div class="wrap aicpp-wrap">
            <h1>⚙️ Settings — Multi-Provider API Configuration</h1>
            <form method="post"><?php wp_nonce_field('aicpp_set'); ?>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🔐</span> Access Control</h2>
                    <table class="form-table">
                        <tr><th>🔒 Require Login</th><td>
                            <label><input type="checkbox" name="require_login" <?php checked($require_login); ?>> <strong>Require users to log in before chatting</strong></label>
                            <p class="description">Recommended: Since personas are assigned per-client, users must log in to see their assigned personas.</p>
                        </td></tr>
                        <tr><th>💬 Login Message</th><td>
                            <textarea name="login_message" rows="3" class="large-text"><?php echo esc_textarea($login_message); ?></textarea>
                            <p class="description">Message shown to logged-out users.</p>
                        </td></tr>
                    </table>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🏗️</span> Default AI Provider</h2>
                    <p class="description">Select the default provider. The system auto-detects based on model name when using personas.</p>
                    <select name="provider" id="provider_select" style="font-size:16px;padding:10px;min-width:300px">
                        <?php foreach ($providers as $key => $p): ?>
                        <option value="<?php echo esc_attr($key); ?>" <?php selected($provider, $key); ?>><?php echo $p['icon']; ?> <?php echo esc_html($p['name']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">🔑</span> API Keys</h2>
                    <p class="description">Enter API keys for all providers you want to use. The plugin auto-detects which provider to use based on the model name.</p>
                    <div class="aicpp-providers-grid">
                        <?php foreach ($providers as $key => $p): ?>
                        <div class="aicpp-provider-card <?php echo ($provider===$key)?'active':''; ?>" data-provider="<?php echo esc_attr($key); ?>">
                            <h4><?php echo $p['icon']; ?> <?php echo esc_html($p['name']); ?>
                            <?php if (!empty($keys[$key])): ?><span class="aicpp-provider-badge connected">✅ Connected</span><?php endif; ?></h4>
                            <input type="text" name="<?php echo esc_attr($key); ?>_key" value="<?php echo esc_attr($keys[$key]); ?>" class="large-text" placeholder="<?php echo esc_attr($p['placeholder']); ?>" autocomplete="off">
                            <p class="description">Get from <a href="<?php echo esc_url($p['url']); ?>" target="_blank" rel="noopener"><?php echo esc_html(str_replace('https://', '', $p['url'])); ?></a></p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="aicpp-card">
                    <h2><span class="aicpp-section-icon">📏</span> Limits</h2>
                    <table class="form-table">
                        <tr><th>📝 Max Message Length</th><td><input type="number" name="max_message_length" value="<?php echo esc_attr($max_len); ?>" min="100" max="100000"></td></tr>
                    </table>
                </div>
                <p><input type="submit" name="save_set" class="button button-primary button-large" value="💾 Save Settings"></p>
            </form>
        </div>
        <script>
        document.getElementById('provider_select').addEventListener('change', function(){
            document.querySelectorAll('.aicpp-provider-card').forEach(function(c){c.classList.remove('active')});
            var s=document.querySelector('.aicpp-provider-card[data-provider="'+this.value+'"]');
            if(s)s.classList.add('active');
        });
        </script>
        <?php
    }

    // ===================== ADMIN AJAX: PERSONA CRUD =====================
    public function ajax_get_persona() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;
        $p = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table_personas} WHERE id = %d", intval($_POST['persona_id'])), ARRAY_A);
        $p ? wp_send_json_success($p) : wp_send_json_error(['message' => 'Not found']);
    }

    public function ajax_save_persona() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $id   = intval($_POST['persona_id'] ?? 0);
        $visibility = sanitize_text_field($_POST['visibility'] ?? 'private');
        if (!in_array($visibility, ['public', 'private'], true)) $visibility = 'private';

        $data = [
            'name'                        => sanitize_text_field($_POST['name'] ?? ''),
            'description'                 => sanitize_textarea_field($_POST['description'] ?? ''),
            'avatar_initials'             => sanitize_text_field(mb_substr($_POST['avatar_initials'] ?? '', 0, 4)),
            'avatar_color'                => sanitize_hex_color($_POST['avatar_color'] ?? '#667eea') ?: '#667eea',
            'system_prompt'               => wp_kses_post($_POST['system_prompt'] ?? ''),
            'emotional_intelligence_code' => wp_kses_post($_POST['emotional_intelligence_code'] ?? ''),
            'rewards_code'                => wp_kses_post($_POST['rewards_code'] ?? ''),
            'use_global_ei'               => ($_POST['use_global_ei'] ?? '0') === '1' ? 1 : 0,
            'use_global_rewards'          => ($_POST['use_global_rewards'] ?? '0') === '1' ? 1 : 0,
            'model'                       => sanitize_text_field($_POST['model'] ?? 'gpt-4'),
            'temperature'                 => max(0.0, min(2.0, floatval($_POST['temperature'] ?? 0.7))),
            'max_tokens'                  => max(1, min(128000, intval($_POST['max_tokens'] ?? 2000))),
            'visibility'                  => $visibility,
            'created_by'                  => get_current_user_id(),
        ];

        if (empty($data['name']) || empty($data['system_prompt'])) {
            wp_send_json_error(['message' => 'Name and system prompt are required.']);
        }

        if (empty($data['avatar_initials'])) {
            $words = explode(' ', $data['name']);
            $data['avatar_initials'] = mb_strtoupper(mb_substr($words[0], 0, 1) . (isset($words[1]) ? mb_substr($words[1], 0, 1) : mb_substr($words[0], 1, 1)));
        }

        $format = ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%f', '%d', '%s', '%d'];

        if ($id > 0) {
            unset($data['created_by']);
            array_pop($format);
            $result = $wpdb->update($this->table_personas, $data, ['id' => $id], $format, ['%d']);
            $persona_id = $id;
        } else {
            $result = $wpdb->insert($this->table_personas, $data, $format);
            $persona_id = $wpdb->insert_id;
        }

        if ($result === false) {
            wp_send_json_error(['message' => 'Database error: ' . $wpdb->last_error]);
        }

        wp_send_json_success(['message' => 'Saved', 'persona_id' => $persona_id]);
    }

    public function ajax_delete_persona() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;
        $id = intval($_POST['persona_id'] ?? 0);
        $wpdb->delete($this->table_persona_assignments, ['persona_id' => $id], ['%d']);
        $wpdb->delete($this->table_personas, ['id' => $id], ['%d']);
        wp_send_json_success(['message' => 'Deleted']);
    }

    // ===================== ADMIN AJAX: USER SEARCH & ASSIGNMENT =====================
    public function ajax_search_users() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);

        $query = sanitize_text_field($_POST['query'] ?? '');
        if (strlen($query) < 2) wp_send_json_error(['message' => 'Query too short']);

        $users = get_users([
            'search'         => '*' . $query . '*',
            'search_columns' => ['user_login', 'user_email', 'display_name'],
            'number'         => 20,
            'fields'         => ['ID', 'user_login', 'user_email', 'display_name'],
        ]);

        wp_send_json_success(['users' => $users]);
    }

    public function ajax_get_persona_users() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $persona_id = intval($_POST['persona_id'] ?? 0);
        $users = $wpdb->get_results($wpdb->prepare(
            "SELECT u.ID, u.user_login, u.user_email, u.display_name
             FROM {$this->table_persona_assignments} pa
             JOIN {$wpdb->users} u ON pa.user_id = u.ID
             WHERE pa.persona_id = %d
             ORDER BY u.display_name ASC",
            $persona_id
        ));

        wp_send_json_success(['users' => $users]);
    }

    public function ajax_assign_persona() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $persona_id = intval($_POST['persona_id'] ?? 0);
        $user_id    = intval($_POST['user_id'] ?? 0);

        if (!$persona_id || !$user_id) wp_send_json_error(['message' => 'Invalid data']);

        $persona = $wpdb->get_row($wpdb->prepare("SELECT id, visibility FROM {$this->table_personas} WHERE id = %d", $persona_id));
        if (!$persona) wp_send_json_error(['message' => 'Persona not found']);

        $user = get_user_by('id', $user_id);
        if (!$user) wp_send_json_error(['message' => 'User not found']);

        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->table_persona_assignments} WHERE persona_id = %d AND user_id = %d",
            $persona_id, $user_id
        ));

        if ($exists > 0) wp_send_json_error(['message' => 'This persona is already assigned to this user.']);

        $result = $wpdb->insert($this->table_persona_assignments, [
            'persona_id'  => $persona_id,
            'user_id'     => $user_id,
            'assigned_by' => get_current_user_id(),
        ], ['%d', '%d', '%d']);

        if ($result === false) {
            wp_send_json_error(['message' => 'Database error']);
        }

        wp_send_json_success(['message' => 'Assigned successfully']);
    }

    public function ajax_unassign_persona() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $persona_id = intval($_POST['persona_id'] ?? 0);
        $user_id    = intval($_POST['user_id'] ?? 0);

        $wpdb->delete($this->table_persona_assignments, [
            'persona_id' => $persona_id,
            'user_id'    => $user_id,
        ], ['%d', '%d']);

        wp_send_json_success(['message' => 'Removed']);
    }

    public function ajax_get_user_personas() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $user_id = intval($_POST['user_id'] ?? 0);
        $personas = $wpdb->get_results($wpdb->prepare(
            "SELECT p.id, p.name, p.model FROM {$this->table_personas} p
             INNER JOIN {$this->table_persona_assignments} pa ON p.id = pa.persona_id
             WHERE pa.user_id = %d ORDER BY p.name ASC",
            $user_id
        ));

        wp_send_json_success(['personas' => $personas]);
    }

    public function ajax_bulk_assign() {
        check_ajax_referer('aicpp', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Denied']);
        global $wpdb;

        $persona_id = intval($_POST['persona_id'] ?? 0);
        $user_ids   = array_map('intval', json_decode(stripslashes($_POST['user_ids'] ?? '[]'), true) ?: []);
        $admin_id   = get_current_user_id();

        $count = 0;
        foreach ($user_ids as $uid) {
            if ($uid <= 0) continue;
            $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->table_persona_assignments} WHERE persona_id = %d AND user_id = %d",
                $persona_id, $uid
            ));
            if (!$exists) {
                $wpdb->insert($this->table_persona_assignments, [
                    'persona_id' => $persona_id, 'user_id' => $uid, 'assigned_by' => $admin_id
                ], ['%d', '%d', '%d']);
                $count++;
            }
        }

        wp_send_json_success(['message' => "Assigned to {$count} user(s)"]);
    }

    // ===================== PUBLIC AJAX: GET MY PERSONAS =====================
    public function ajax_get_my_personas() {
        check_ajax_referer('aicpp_chat', 'nonce');

        $user_id = get_current_user_id();
        if (!$user_id) {
            wp_send_json_error(['message' => 'Please log in to access your AI assistants.']);
        }

        $personas = $this->get_user_personas($user_id);
        $result = [];
        foreach ($personas as $p) {
            $result[] = [
                'id'               => $p->id,
                'name'             => $p->name,
                'description'      => $p->description,
                'avatar_initials'  => $p->avatar_initials ?: mb_strtoupper(mb_substr($p->name, 0, 2)),
                'avatar_color'     => $p->avatar_color ?: '#667eea',
                'model'            => $p->model,
                'visibility'       => $p->visibility,
            ];
        }

        // Also include main character info
        $main_enabled = get_option('aicpp_main_char_enabled', '0') === '1';
        $main_char = null;
        if ($main_enabled) {
            $main_char = [
                'name'            => get_option('aicpp_main_char_name', 'AI Assistant'),
                'description'     => get_option('aicpp_main_char_description', 'Your helpful AI assistant'),
                'avatar_initials' => get_option('aicpp_main_char_avatar_initials', 'AI'),
                'avatar_color'    => get_option('aicpp_main_char_avatar_color', '#667eea'),
                'model'           => get_option('aicpp_main_char_model', 'gpt-4'),
            ];
        }

        wp_send_json_success(['personas' => $result, 'main_character' => $main_char]);
    }

    // ===================== CONVERSATION AJAX =====================
    public function ajax_get_conversations() {
        check_ajax_referer('aicpp_chat', 'nonce');
        global $wpdb;

        $user_id = get_current_user_id();
        if (!$user_id) {
            wp_send_json_success(['conversations' => []]);
            return;
        }

        $conversations = $wpdb->get_results($wpdb->prepare(
            "SELECT c.id, c.title, c.token_count, c.persona_id, c.is_main_chat, c.created_at, c.updated_at,
                    p.name as persona_name, p.avatar_initials, p.avatar_color
             FROM {$this->table_conversations} c
             LEFT JOIN {$this->table_personas} p ON c.persona_id = p.id
             WHERE c.user_id = %d
             ORDER BY c.updated_at DESC LIMIT 50",
            $user_id
        ));

        foreach ($conversations as &$c) {
            if (empty($c->title)) {
                $first_msg = $wpdb->get_var($wpdb->prepare(
                    "SELECT content FROM {$this->table_messages} WHERE conversation_id = %d AND role = 'user' ORDER BY id ASC LIMIT 1",
                    $c->id
                ));
                $c->title = $first_msg ? wp_trim_words($first_msg, 8, '...') : 'Conversation #' . $c->id;
                $wpdb->update($this->table_conversations, ['title' => $c->title], ['id' => $c->id], ['%s'], ['%d']);
            }
        }

        wp_send_json_success(['conversations' => $conversations]);
    }

    public function ajax_load_conversation() {
        check_ajax_referer('aicpp_chat', 'nonce');
        global $wpdb;

        $conv_id = intval($_POST['conversation_id'] ?? 0);
        $conv    = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table_conversations} WHERE id = %d", $conv_id));
        if (!$conv) wp_send_json_error(['message' => 'Not found']);

        if (!$this->verify_conversation_ownership($conv)) {
            wp_send_json_error(['message' => 'Access denied']);
        }

        $user_id = get_current_user_id();
        if ($user_id && $conv->persona_id && !$conv->is_main_chat && !$this->user_can_access_persona($user_id, $conv->persona_id)) {
            wp_send_json_error(['message' => 'You no longer have access to this persona.']);
        }

        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT role, content FROM {$this->table_messages} WHERE conversation_id = %d ORDER BY id ASC",
            $conv_id
        ), ARRAY_A);

        wp_send_json_success([
            'messages'    => $messages ?: [],
            'session_id'  => $conv->session_id,
            'persona_id'  => $conv->persona_id,
            'is_main_chat' => (int)$conv->is_main_chat,
        ]);
    }

    public function ajax_delete_conversation() {
        check_ajax_referer('aicpp_chat', 'nonce');
        global $wpdb;

        $conv_id = intval($_POST['conversation_id'] ?? 0);
        $conv    = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table_conversations} WHERE id = %d", $conv_id));
        if (!$conv) wp_send_json_error(['message' => 'Not found']);
        if (!$this->verify_conversation_ownership($conv)) wp_send_json_error(['message' => 'Access denied']);

        $wpdb->delete($this->table_messages, ['conversation_id' => $conv_id], ['%d']);
        $wpdb->delete($this->table_conversations, ['id' => $conv_id], ['%d']);
        wp_send_json_success(['message' => 'Deleted']);
    }

    // ===================== FILE UPLOAD =====================
    public function ajax_upload_file() {
        check_ajax_referer('aicpp_chat', 'nonce');
        if (!$this->check_rate_limit('upload', 20, 300)) wp_send_json_error(['message' => 'Rate limit exceeded.']);
        if (empty($_FILES['file'])) wp_send_json_error(['message' => 'No file uploaded']);

        $file = $_FILES['file'];
        if ($file['size'] > 10 * 1024 * 1024) wp_send_json_error(['message' => 'File too large. Max 10MB.']);

        $file_info = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
        $allowed = ['jpg','jpeg','png','gif','webp','pdf','txt'];
        if (empty($file_info['ext']) || !in_array(strtolower($file_info['ext']), $allowed, true)) {
            wp_send_json_error(['message' => 'File type not allowed.']);
        }

        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');

        $upload = wp_handle_upload($file, ['test_form' => false]);
        if (isset($upload['error'])) wp_send_json_error(['message' => $upload['error']]);

        $actual_type = $file_info['type'] ?: $upload['type'];
        $response = ['file_url' => $upload['url'], 'file_name' => basename($upload['file']), 'file_type' => $actual_type];

        if (strpos($actual_type, 'image/') === 0 && filesize($upload['file']) <= 2 * 1024 * 1024) {
            $img_data = file_get_contents($upload['file']);
            if ($img_data !== false) $response['file_data'] = 'data:' . $actual_type . ';base64,' . base64_encode($img_data);
        }
        if ($actual_type === 'text/plain') {
            $txt = file_get_contents($upload['file'], false, null, 0, 5000);
            if ($txt !== false) $response['file_data'] = $txt;
        }

        wp_send_json_success($response);
    }

    // ===================== AUDIO TRANSCRIPTION =====================
    public function ajax_transcribe_audio() {
        check_ajax_referer('aicpp_chat', 'nonce');
        if (!$this->check_rate_limit('transcribe', 10, 300)) wp_send_json_error(['message' => 'Rate limit exceeded.']);
        if (empty($_FILES['audio'])) wp_send_json_error(['message' => 'No audio received']);

        $key = $this->get_api_key('openai');
        if (!$key) wp_send_json_error(['message' => 'OpenAI API key required for transcription.']);

        $boundary = wp_generate_password(24, false);
        $audio_name = sanitize_file_name($_FILES['audio']['name'] ?: 'recording.webm');
        $body  = "--{$boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nwhisper-1\r\n";
        $body .= "--{$boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{$audio_name}\"\r\nContent-Type: audio/webm\r\n\r\n";
        $body .= file_get_contents($_FILES['audio']['tmp_name']) . "\r\n--{$boundary}--\r\n";

        $r = wp_remote_post('https://api.openai.com/v1/audio/transcriptions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'multipart/form-data; boundary=' . $boundary],
            'body' => $body, 'timeout' => 60,
        ]);

        if (is_wp_error($r)) wp_send_json_error(['message' => $r->get_error_message()]);
        $result = json_decode(wp_remote_retrieve_body($r), true);
        isset($result['text']) ? wp_send_json_success(['text' => $result['text']]) : wp_send_json_error(['message' => $result['error']['message'] ?? 'Failed']);
    }

    // ===================== REGISTRATION =====================
    public function ajax_register_user() {
        check_ajax_referer('aicpp_register', 'nonce');
        if (is_user_logged_in()) wp_send_json_error(['message' => 'Already logged in.']);
        if (!get_option('users_can_register')) wp_send_json_error(['message' => 'Registration disabled.']);
        if (!$this->check_rate_limit('register', 3, 900)) wp_send_json_error(['message' => 'Too many attempts. Try again later.']);

        $username     = sanitize_user($_POST['username'] ?? '');
        $email        = sanitize_email($_POST['email'] ?? '');
        $password     = $_POST['password'] ?? '';
        $display_name = sanitize_text_field($_POST['display_name'] ?? '');

        if (empty($username) || empty($email) || empty($password)) wp_send_json_error(['message' => 'All fields required.']);
        if (strlen($password) < 8) wp_send_json_error(['message' => 'Password must be at least 8 characters.']);
        if (!is_email($email)) wp_send_json_error(['message' => 'Invalid email.']);
        if (username_exists($username)) wp_send_json_error(['message' => 'Username taken.']);
        if (email_exists($email)) wp_send_json_error(['message' => 'Email already registered.']);

        $user_id = wp_create_user($username, $password, $email);
        if (is_wp_error($user_id)) wp_send_json_error(['message' => $user_id->get_error_message()]);

        if ($display_name) wp_update_user(['ID' => $user_id, 'display_name' => wp_strip_all_tags($display_name)]);

        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, true);

        wp_send_json_success(['message' => 'Registration successful!', 'user_id' => $user_id, 'display_name' => $display_name ?: $username]);
    }

    // ===================== LOGIN =====================
    public function ajax_login_user() {
        check_ajax_referer('aicpp_login', 'nonce');
        if (is_user_logged_in()) wp_send_json_error(['message' => 'Already logged in.']);
        if (!$this->check_rate_limit('login', 5, 300)) wp_send_json_error(['message' => 'Too many attempts. Try again later.']);

        $login    = sanitize_text_field($_POST['login'] ?? '');
        $password = $_POST['password'] ?? '';
        if (empty($login) || empty($password)) wp_send_json_error(['message' => 'Username/email and password required.']);

        $creds = ['user_login' => $login, 'user_password' => $password, 'remember' => true];
        if (is_email($login)) {
            $user = get_user_by('email', $login);
            if ($user) $creds['user_login'] = $user->user_login;
        }

        $user = wp_signon($creds, is_ssl());

        if (is_wp_error($user)) {
            wp_send_json_error(['message' => 'Invalid username/email or password.']);
        }

        wp_set_current_user($user->ID);

        wp_send_json_success([
            'message'      => 'Welcome back, ' . ($user->display_name ?: $user->user_login) . '!',
            'user_id'      => $user->ID,
            'display_name' => $user->display_name ?: $user->user_login,
        ]);
    }

    // ===================== MAIN CHARACTER CHAT HANDLER =====================
    public function handle_chat_main() {
        check_ajax_referer('aicpp_chat', 'nonce');
        global $wpdb;

        if (!$this->check_rate_limit('chat', 30, 300)) wp_send_json_error(['message' => 'Rate limit exceeded.']);

        $main_enabled = get_option('aicpp_main_char_enabled', '0') === '1';
        if (!$main_enabled) wp_send_json_error(['message' => 'Main character is not enabled.']);

        $message = sanitize_textarea_field($_POST['message'] ?? '');
        $session = sanitize_text_field($_POST['session_id'] ?? '');
        $user_id = get_current_user_id();

        $max_len = intval(get_option('aicpp_max_message_length', 10000));
        if (mb_strlen($message) > $max_len) wp_send_json_error(['message' => "Message too long. Max {$max_len} characters."]);
        if (empty($message)) wp_send_json_error(['message' => 'Message cannot be empty.']);
        if (empty($session)) wp_send_json_error(['message' => 'Invalid session.']);

        // Build a pseudo-persona object from main character settings
        $main_persona = (object)[
            'id'                          => 0,
            'name'                        => get_option('aicpp_main_char_name', 'AI Assistant'),
            'system_prompt'               => get_option('aicpp_main_char_system_prompt', 'You are a helpful AI assistant.'),
            'emotional_intelligence_code' => '',
            'rewards_code'                => '',
            'use_global_ei'               => 1,
            'use_global_rewards'          => 1,
            'model'                       => get_option('aicpp_main_char_model', 'gpt-4'),
            'temperature'                 => floatval(get_option('aicpp_main_char_temperature', '0.7')),
            'max_tokens'                  => intval(get_option('aicpp_main_char_max_tokens', '2000')),
        ];

        $conv = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_conversations} WHERE session_id = %s AND is_main_chat = 1 ORDER BY id DESC LIMIT 1", $session
        ));

        if (!$conv) {
            $wpdb->insert($this->table_conversations, [
                'user_id' => $user_id, 'persona_id' => null, 'session_id' => $session,
                'title' => wp_trim_words($message, 8, '...'), 'token_count' => 0, 'is_main_chat' => 1, 'updated_at' => current_time('mysql'),
            ], ['%d', '%d', '%s', '%s', '%d', '%d', '%s']);
            $conv_id = $wpdb->insert_id;
            $token_count = 0;
        } else {
            $conv_id = $conv->id;
            $token_count = (int)$conv->token_count;
        }

        // Handle attachments
        $attachment_context = '';
        if (!empty($_POST['has_attachment']) && $_POST['has_attachment'] === '1') {
            $att_type = sanitize_text_field($_POST['attachment_type'] ?? '');
            $att_url  = esc_url_raw($_POST['attachment_url'] ?? '');
            $att_data = $_POST['attachment_data'] ?? '';
            if (strpos($att_type, 'image/') === 0 && $att_url) $attachment_context = "\n\n[User shared an image: {$att_url}]";
            elseif ($att_type === 'text/plain' && $att_data) $attachment_context = "\n\n[User shared text file:\n" . sanitize_textarea_field(mb_substr($att_data, 0, 5000)) . "\n]";
            elseif ($att_type === 'application/pdf' && $att_url) $attachment_context = "\n\n[User shared PDF: {$att_url}]";
        }

        $user_content = $message . $attachment_context;

        $wpdb->insert($this->table_messages, [
            'conversation_id' => $conv_id, 'role' => 'user', 'content' => $message, 'raw_content' => $user_content,
        ], ['%d', '%s', '%s', '%s']);

        $recent = $wpdb->get_results($wpdb->prepare(
            "SELECT role, raw_content, content FROM {$this->table_messages} WHERE conversation_id = %d ORDER BY id DESC LIMIT 20", $conv_id
        ), ARRAY_A);
        $recent = array_reverse($recent);

        $api_history = [];
        foreach ($recent as $rm) {
            $api_history[] = ['role' => $rm['role'], 'content' => $rm['raw_content'] ?: $rm['content']];
        }

        $api_msgs = $this->build_messages($main_persona, $api_history, $session);
        $response = $this->call_api($api_msgs, $main_persona);

        if (isset($response['error'])) wp_send_json_error(['message' => $response['error']]);

        $reply  = $response['choices'][0]['message']['content'] ?? '';
        $tokens = $response['usage']['total_tokens'] ?? 0;

        $wpdb->insert($this->table_messages, [
            'conversation_id' => $conv_id, 'role' => 'assistant', 'content' => $reply, 'raw_content' => $reply,
        ], ['%d', '%s', '%s', '%s']);

        $wpdb->update($this->table_conversations,
            ['token_count' => $token_count + $tokens, 'updated_at' => current_time('mysql')],
            ['id' => $conv_id], ['%d', '%s'], ['%d']
        );

        wp_send_json_success(['message' => $reply, 'tokens' => $tokens, 'conversation_id' => $conv_id]);
    }

    // ===================== PERSONA CHAT HANDLER =====================
    public function handle_chat() {
        check_ajax_referer('aicpp_chat', 'nonce');
        global $wpdb;

        if (!$this->check_rate_limit('chat', 30, 300)) wp_send_json_error(['message' => 'Rate limit exceeded.']);

        $persona_id = intval($_POST['persona_id'] ?? 0);
        $message    = sanitize_textarea_field($_POST['message'] ?? '');
        $session    = sanitize_text_field($_POST['session_id'] ?? '');
        $user_id    = get_current_user_id();

        $max_len = intval(get_option('aicpp_max_message_length', 10000));
        if (mb_strlen($message) > $max_len) wp_send_json_error(['message' => "Message too long. Max {$max_len} characters."]);
        if (empty($message)) wp_send_json_error(['message' => 'Message cannot be empty.']);
        if (empty($session)) wp_send_json_error(['message' => 'Invalid session.']);

        if ($user_id && !$this->user_can_access_persona($user_id, $persona_id)) {
            wp_send_json_error(['message' => 'You do not have access to this persona.']);
        }

        $persona = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table_personas} WHERE id = %d", $persona_id));
        if (!$persona) wp_send_json_error(['message' => 'Persona not found']);

        $conv = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$this->table_conversations} WHERE session_id = %s AND is_main_chat = 0 ORDER BY id DESC LIMIT 1", $session
        ));

        if (!$conv) {
            $wpdb->insert($this->table_conversations, [
                'user_id' => $user_id, 'persona_id' => $persona_id, 'session_id' => $session,
                'title' => wp_trim_words($message, 8, '...'), 'token_count' => 0, 'is_main_chat' => 0, 'updated_at' => current_time('mysql'),
            ], ['%d', '%d', '%s', '%s', '%d', '%d', '%s']);
            $conv_id = $wpdb->insert_id;
            $token_count = 0;
        } else {
            $conv_id = $conv->id;
            $token_count = (int)$conv->token_count;
        }

        $attachment_context = '';
        if (!empty($_POST['has_attachment']) && $_POST['has_attachment'] === '1') {
            $att_type = sanitize_text_field($_POST['attachment_type'] ?? '');
            $att_url  = esc_url_raw($_POST['attachment_url'] ?? '');
            $att_data = $_POST['attachment_data'] ?? '';
            if (strpos($att_type, 'image/') === 0 && $att_url) $attachment_context = "\n\n[User shared an image: {$att_url}]";
            elseif ($att_type === 'text/plain' && $att_data) $attachment_context = "\n\n[User shared text file:\n" . sanitize_textarea_field(mb_substr($att_data, 0, 5000)) . "\n]";
            elseif ($att_type === 'application/pdf' && $att_url) $attachment_context = "\n\n[User shared PDF: {$att_url}]";
        }

        $user_content = $message . $attachment_context;

        $wpdb->insert($this->table_messages, [
            'conversation_id' => $conv_id, 'role' => 'user', 'content' => $message, 'raw_content' => $user_content,
        ], ['%d', '%s', '%s', '%s']);

        $recent = $wpdb->get_results($wpdb->prepare(
            "SELECT role, raw_content, content FROM {$this->table_messages} WHERE conversation_id = %d ORDER BY id DESC LIMIT 20", $conv_id
        ), ARRAY_A);
        $recent = array_reverse($recent);

        $api_history = [];
        foreach ($recent as $rm) {
            $api_history[] = ['role' => $rm['role'], 'content' => $rm['raw_content'] ?: $rm['content']];
        }

        $api_msgs = $this->build_messages($persona, $api_history, $session);
        $response = $this->call_api($api_msgs, $persona);

        if (isset($response['error'])) wp_send_json_error(['message' => $response['error']]);

        $reply  = $response['choices'][0]['message']['content'] ?? '';
        $tokens = $response['usage']['total_tokens'] ?? 0;

        $wpdb->insert($this->table_messages, [
            'conversation_id' => $conv_id, 'role' => 'assistant', 'content' => $reply, 'raw_content' => $reply,
        ], ['%d', '%s', '%s', '%s']);

        $wpdb->update($this->table_conversations,
            ['token_count' => $token_count + $tokens, 'updated_at' => current_time('mysql')],
            ['id' => $conv_id], ['%d', '%s'], ['%d']
        );

        wp_send_json_success(['message' => $reply, 'tokens' => $tokens, 'conversation_id' => $conv_id]);
    }

    // ===================== BUILD MESSAGES =====================
    private function build_messages($persona, $msgs, $session = '') {
        $binding = get_option('aicpp_character_binding_active', '0') === '1';
        $bcode   = get_option('aicpp_active_character_code', '');

        $sys = ($binding && !empty(trim($bcode))) ? $bcode . "\n\nStay in character always." : $persona->system_prompt;

        $ei = '';
        if (!empty(trim($persona->emotional_intelligence_code ?? ''))) $ei = $persona->emotional_intelligence_code;
        elseif ($persona->use_global_ei && get_option('aicpp_global_ei_enabled', '0') === '1') $ei = get_option('aicpp_global_ei_code', '');
        if (!empty(trim($ei))) $sys .= "\n\n## EMOTIONAL INTELLIGENCE\n" . $ei;

        $rew = '';
        if (!empty(trim($persona->rewards_code ?? ''))) $rew = $persona->rewards_code;
        elseif ($persona->use_global_rewards && get_option('aicpp_global_rewards_enabled', '0') === '1') $rew = get_option('aicpp_global_rewards_code', '');
        if (!empty(trim($rew))) $sys .= "\n\n## REWARDS\n" . $rew;

        $injection = $this->get_injection_content($session);
        if (!empty($injection)) $sys .= "\n\n## ADDITIONAL INSTRUCTIONS\n" . $injection;

        $result = [['role' => 'system', 'content' => $sys]];
        foreach (array_slice($msgs, -20) as $m) {
            $result[] = ['role' => $m['role'], 'content' => $m['content']];
        }
        return $result;
    }

    // ===================== 5-SLOT INJECTION =====================
    private function get_injection_content($session) {
        if (get_option('aicpp_injection_enabled', '0') !== '1') return '';
        global $wpdb;

        $user_id  = get_current_user_id();
        $user_key = $user_id ? 'u_' . $user_id : 'g_' . md5($session);

        $state = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table_injection_state} WHERE user_key = %s", $user_key));

        if (!$state) {
            $wpdb->insert($this->table_injection_state, ['user_key'=>$user_key,'current_slot'=>1,'question_count'=>1,'updated_at'=>current_time('mysql')], ['%s','%d','%d','%s']);
            $slot = 1; $question_count = 1;
        } else {
            $slot = max(1, min(5, (int)$state->current_slot));
            $question_count = max(1, (int)$state->question_count);
        }

        $hidden = '';
        if (get_option("aicpp_slot{$slot}_enabled", '1') === '1') $hidden = get_option("aicpp_hidden_message_{$slot}", '');

        if (!empty($hidden)) {
            $safe_name = mb_substr(wp_strip_all_tags(wp_get_current_user()->display_name ?: 'Friend'), 0, 50);
            $hidden = str_replace(
                ['{user_name}', '{time_of_day}', '{date}', '{slot_number}', '{question_number}'],
                [$safe_name, $this->time_of_day(), current_time('F j, Y'), (string)$slot, (string)$question_count],
                $hidden
            );
        }

        $next = ($slot % 5) + 1;
        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$this->table_injection_state} (user_key,current_slot,question_count,updated_at) VALUES (%s,%d,%d,%s) ON DUPLICATE KEY UPDATE current_slot=%d,question_count=%d,updated_at=%s",
            $user_key, $next, $question_count+1, current_time('mysql'), $next, $question_count+1, current_time('mysql')
        ));

        return $hidden;
    }

    private function time_of_day() {
        $h = (int)current_time('G');
        if ($h < 12) return 'morning';
        if ($h < 17) return 'afternoon';
        if ($h < 21) return 'evening';
        return 'night';
    }

    // ===================== API PROVIDERS =====================
    private function detect_provider($model) {
        $m = strtolower($model);
        if (strpos($m, 'openrouter/') === 0) return 'openrouter';
        if (strpos($m, 'gpt') !== false || strpos($m, 'o1') !== false) return 'openai';
        if (strpos($m, 'claude') !== false) return 'anthropic';
        if (strpos($m, 'gemini') !== false) return 'google';
        if (strpos($m, 'deepseek') !== false) return 'deepseek';
        if (strpos($m, 'mistral') !== false || strpos($m, 'mixtral') !== false || strpos($m, 'open-') !== false) return 'mistral';
        if (strpos($m, 'llama') !== false || strpos($m, 'gemma') !== false) return 'groq';
        return get_option('aicpp_api_provider', 'openai');
    }

    private function call_api($msgs, $persona) {
        $p = $this->detect_provider($persona->model);
        switch ($p) {
            case 'anthropic':  return $this->call_anthropic($msgs, $persona);
            case 'google':     return $this->call_google($msgs, $persona);
            case 'deepseek':   return $this->call_deepseek($msgs, $persona);
            case 'mistral':    return $this->call_mistral($msgs, $persona);
            case 'groq':       return $this->call_groq($msgs, $persona);
            case 'openrouter': return $this->call_openrouter($msgs, $persona);
            default:           return $this->call_openai($msgs, $persona);
        }
    }

    private function call_openai($msgs, $persona) {
        $key = $this->get_api_key('openai');
        if (!$key) return ['error' => 'OpenAI API key not set.'];
        $r = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['model' => $persona->model, 'messages' => $msgs, 'temperature' => (float)$persona->temperature, 'max_tokens' => (int)$persona->max_tokens]),
            'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        return isset($b['error']) ? ['error' => $b['error']['message']] : $b;
    }

    private function call_anthropic($msgs, $persona) {
        $key = $this->get_api_key('anthropic');
        if (!$key) return ['error' => 'Anthropic API key not set.'];
        $sys = ''; $api = [];
        foreach ($msgs as $m) {
            if ($m['role'] === 'system') $sys .= $m['content'] . "\n";
            else $api[] = ['role' => $m['role'], 'content' => $m['content']];
        }
        $bd = ['model' => $persona->model, 'max_tokens' => (int)$persona->max_tokens, 'messages' => $api];
        if (!empty(trim($sys))) $bd['system'] = trim($sys);
        $r = wp_remote_post('https://api.anthropic.com/v1/messages', [
            'headers' => ['x-api-key' => $key, 'anthropic-version' => '2023-06-01', 'Content-Type' => 'application/json'],
            'body' => wp_json_encode($bd), 'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        if (isset($b['error'])) return ['error' => $b['error']['message'] ?? 'Anthropic error'];
        if (isset($b['content'][0]['text'])) return ['choices' => [['message' => ['content' => $b['content'][0]['text']]]], 'usage' => ['total_tokens' => ($b['usage']['input_tokens'] ?? 0) + ($b['usage']['output_tokens'] ?? 0)]];
        return ['error' => 'Unexpected Anthropic response'];
    }

    private function call_google($msgs, $persona) {
        $key = $this->get_api_key('google');
        if (!$key) return ['error' => 'Google API key not set.'];
        $c = []; $si = '';
        foreach ($msgs as $m) {
            if ($m['role'] === 'system') $si .= $m['content'] . "\n";
            else { $r = $m['role'] === 'assistant' ? 'model' : 'user'; $c[] = ['role' => $r, 'parts' => [['text' => $m['content']]]]; }
        }
        $bd = ['contents' => $c, 'generationConfig' => ['temperature' => (float)$persona->temperature, 'maxOutputTokens' => (int)$persona->max_tokens]];
        if (!empty(trim($si))) $bd['systemInstruction'] = ['parts' => [['text' => trim($si)]]];
        $model = sanitize_text_field($persona->model);
        $r = wp_remote_post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}", [
            'headers' => ['Content-Type' => 'application/json'], 'body' => wp_json_encode($bd), 'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        if (isset($b['error'])) return ['error' => $b['error']['message'] ?? 'Google error'];
        if (isset($b['candidates'][0]['content']['parts'][0]['text'])) return ['choices' => [['message' => ['content' => $b['candidates'][0]['content']['parts'][0]['text']]]], 'usage' => ['total_tokens' => ($b['usageMetadata']['promptTokenCount'] ?? 0) + ($b['usageMetadata']['candidatesTokenCount'] ?? 0)]];
        return ['error' => 'Unexpected Google response'];
    }

    private function call_deepseek($msgs, $persona) {
        $key = $this->get_api_key('deepseek');
        if (!$key) return ['error' => 'DeepSeek key not set.'];
        $r = wp_remote_post('https://api.deepseek.com/chat/completions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['model' => $persona->model, 'messages' => $msgs, 'temperature' => (float)$persona->temperature, 'max_tokens' => (int)$persona->max_tokens]),
            'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        return isset($b['error']) ? ['error' => $b['error']['message'] ?? 'DeepSeek error'] : $b;
    }

    private function call_mistral($msgs, $persona) {
        $key = $this->get_api_key('mistral');
        if (!$key) return ['error' => 'Mistral key not set.'];
        $r = wp_remote_post('https://api.mistral.ai/v1/chat/completions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['model' => $persona->model, 'messages' => $msgs, 'temperature' => (float)$persona->temperature, 'max_tokens' => (int)$persona->max_tokens]),
            'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        return isset($b['error']) ? ['error' => $b['error']['message'] ?? 'Mistral error'] : $b;
    }

    private function call_groq($msgs, $persona) {
        $key = $this->get_api_key('groq');
        if (!$key) return ['error' => 'Groq key not set.'];
        $r = wp_remote_post('https://api.groq.com/openai/v1/chat/completions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['model' => $persona->model, 'messages' => $msgs, 'temperature' => (float)$persona->temperature, 'max_tokens' => (int)$persona->max_tokens]),
            'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        return isset($b['error']) ? ['error' => $b['error']['message'] ?? 'Groq error'] : $b;
    }

    private function call_openrouter($msgs, $persona) {
        $key = $this->get_api_key('openrouter');
        if (!$key) return ['error' => 'OpenRouter key not set.'];
        $model = str_replace('openrouter/', '', $persona->model);
        $r = wp_remote_post('https://openrouter.ai/api/v1/chat/completions', [
            'headers' => ['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json', 'HTTP-Referer' => get_site_url(), 'X-Title' => get_bloginfo('name')],
            'body' => wp_json_encode(['model' => $model, 'messages' => $msgs, 'temperature' => (float)$persona->temperature, 'max_tokens' => (int)$persona->max_tokens]),
            'timeout' => 120,
        ]);
        if (is_wp_error($r)) return ['error' => $r->get_error_message()];
        $b = json_decode(wp_remote_retrieve_body($r), true);
        return isset($b['error']) ? ['error' => $b['error']['message'] ?? 'OpenRouter error'] : $b;
    }

    // ===================== SHORTCODE =====================
    public function chat_shortcode($atts) {
        static $css_rendered = false;

        $atts = shortcode_atts([
            'height'       => '700px',
            'show_history' => 'true',
            'allow_upload' => 'true',
            'allow_voice'  => 'true',
        ], $atts);

        $sid           = 'sess_' . wp_generate_uuid4();
        $show_history  = $atts['show_history'] === 'true';
        $allow_upload  = $atts['allow_upload'] === 'true';
        $allow_voice   = $atts['allow_voice'] === 'true';
        $is_logged_in  = is_user_logged_in();
        $require_login = get_option('aicpp_require_login', '1') === '1';
        $chat_nonce    = wp_create_nonce('aicpp_chat');
        $reg_nonce     = wp_create_nonce('aicpp_register');
        $login_nonce   = wp_create_nonce('aicpp_login');
        $ajaxurl       = admin_url('admin-ajax.php');

        ob_start();

        if (!$css_rendered) {
            echo '<style>' . $this->get_frontend_css() . '</style>';
            $css_rendered = true;
        }

        // If login is required and user is not logged in, show login/register form
        if ($require_login && !$is_logged_in) {
            $login_message = get_option('aicpp_login_message', 'Please sign in to access your AI assistant.');
            ?>
            <div id="aicpp-auth-<?php echo esc_attr($sid); ?>" class="aicpp-auth-wrapper" style="max-width:440px;margin:40px auto">
                <div class="aicpp-auth-box">
                    <div class="aicpp-auth-header">
                        <div style="font-size:40px;margin-bottom:12px">&#x1F916;</div>
                        <h2>AI Chat Persona Pro</h2>
                        <p><?php echo esc_html($login_message); ?></p>
                    </div>
                    <div id="login-tab-<?php echo esc_attr($sid); ?>" class="aicpp-auth-tab active">
                        <form id="login-form-<?php echo esc_attr($sid); ?>">
                            <div class="aicpp-auth-field"><label>Email or Username</label><input type="text" id="login-user-<?php echo esc_attr($sid); ?>" placeholder="you@example.com" required></div>
                            <div class="aicpp-auth-field"><label>Password</label><input type="password" id="login-pass-<?php echo esc_attr($sid); ?>" placeholder="Your password" required></div>
                            <div id="login-msg-<?php echo esc_attr($sid); ?>" class="aicpp-auth-msg" style="display:none"></div>
                            <button type="submit" class="aicpp-auth-submit">Sign In</button>
                        </form>
                        <p class="aicpp-auth-switch">Don't have an account? <a href="#" id="show-register-<?php echo esc_attr($sid); ?>">Sign up</a></p>
                    </div>
                    <div id="register-tab-<?php echo esc_attr($sid); ?>" class="aicpp-auth-tab" style="display:none">
                        <form id="register-form-<?php echo esc_attr($sid); ?>">
                            <div class="aicpp-auth-field"><label>Display Name</label><input type="text" id="reg-display-<?php echo esc_attr($sid); ?>" placeholder="Your name"></div>
                            <div class="aicpp-auth-field"><label>Username *</label><input type="text" id="reg-user-<?php echo esc_attr($sid); ?>" placeholder="Choose a username" required></div>
                            <div class="aicpp-auth-field"><label>Email *</label><input type="email" id="reg-email-<?php echo esc_attr($sid); ?>" placeholder="you@example.com" required></div>
                            <div class="aicpp-auth-field"><label>Password *</label><input type="password" id="reg-pass-<?php echo esc_attr($sid); ?>" placeholder="Min 8 characters" required minlength="8"></div>
                            <div id="reg-msg-<?php echo esc_attr($sid); ?>" class="aicpp-auth-msg" style="display:none"></div>
                            <button type="submit" class="aicpp-auth-submit">Create Account</button>
                        </form>
                        <p class="aicpp-auth-switch">Already have an account? <a href="#" id="show-login-<?php echo esc_attr($sid); ?>">Sign in</a></p>
                    </div>
                </div>
            </div>
            <script>
            (function(){
                var sid = <?php echo wp_json_encode($sid); ?>;
                var ajaxurl = <?php echo wp_json_encode($ajaxurl); ?>;
                var loginNonce = <?php echo wp_json_encode($login_nonce); ?>;
                var regNonce = <?php echo wp_json_encode($reg_nonce); ?>;
                document.getElementById('show-register-' + sid).addEventListener('click', function(e){ e.preventDefault(); document.getElementById('login-tab-' + sid).style.display = 'none'; document.getElementById('register-tab-' + sid).style.display = 'block'; });
                document.getElementById('show-login-' + sid).addEventListener('click', function(e){ e.preventDefault(); document.getElementById('register-tab-' + sid).style.display = 'none'; document.getElementById('login-tab-' + sid).style.display = 'block'; });
                document.getElementById('login-form-' + sid).addEventListener('submit', function(e){
                    e.preventDefault(); var msg = document.getElementById('login-msg-' + sid); var btn = this.querySelector('.aicpp-auth-submit'); btn.disabled = true; btn.textContent = 'Signing in...';
                    var fd = new FormData(); fd.append('action', 'aicpp_login_user'); fd.append('nonce', loginNonce); fd.append('login', document.getElementById('login-user-' + sid).value); fd.append('password', document.getElementById('login-pass-' + sid).value);
                    fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){ msg.style.display = 'block'; if (d.success) { msg.className = 'aicpp-auth-msg success'; msg.textContent = d.data.message; setTimeout(function(){ location.reload(); }, 1000); } else { msg.className = 'aicpp-auth-msg error'; msg.textContent = d.data.message; btn.disabled = false; btn.textContent = 'Sign In'; } }).catch(function(){ msg.style.display='block'; msg.className='aicpp-auth-msg error'; msg.textContent='Connection error.'; btn.disabled=false; btn.textContent='Sign In'; });
                });
                document.getElementById('register-form-' + sid).addEventListener('submit', function(e){
                    e.preventDefault(); var msg = document.getElementById('reg-msg-' + sid); var btn = this.querySelector('.aicpp-auth-submit'); btn.disabled = true; btn.textContent = 'Creating...';
                    var fd = new FormData(); fd.append('action', 'aicpp_register_user'); fd.append('nonce', regNonce); fd.append('display_name', document.getElementById('reg-display-' + sid).value); fd.append('username', document.getElementById('reg-user-' + sid).value); fd.append('email', document.getElementById('reg-email-' + sid).value); fd.append('password', document.getElementById('reg-pass-' + sid).value);
                    fetch(ajaxurl, {method:'POST', body:fd}).then(function(r){return r.json()}).then(function(d){ msg.style.display = 'block'; if (d.success) { msg.className = 'aicpp-auth-msg success'; msg.textContent = d.data.message; setTimeout(function(){ location.reload(); }, 1000); } else { msg.className = 'aicpp-auth-msg error'; msg.textContent = d.data.message; btn.disabled = false; btn.textContent = 'Create Account'; } }).catch(function(){ msg.style.display='block'; msg.className='aicpp-auth-msg error'; msg.textContent='Connection error.'; btn.disabled=false; btn.textContent='Create Account'; });
                });
            })();
            </script>
            <?php
            return ob_get_clean();
        }

        // ---- LOGGED IN: Show chat interface ----
        $user = wp_get_current_user();
        $main_enabled = get_option('aicpp_main_char_enabled', '0') === '1';
        $main_name = get_option('aicpp_main_char_name', 'AI Assistant');
        $main_initials = get_option('aicpp_main_char_avatar_initials', 'AI');
        $main_color = get_option('aicpp_main_char_avatar_color', '#667eea');
        ?>
        <div id="aicpp-wrapper-<?php echo esc_attr($sid); ?>" class="aicpp-wrapper" style="height:<?php echo esc_attr($atts['height']); ?>">
            <!-- Sidebar -->
            <?php if ($show_history): ?>
            <div class="aicpp-sidebar" id="sidebar-<?php echo esc_attr($sid); ?>">
                <div class="aicpp-sidebar-header">
                    <h3>AI Chat</h3>
                    <button class="aicpp-new-chat" id="new-<?php echo esc_attr($sid); ?>" title="New conversation">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>

                <?php if ($main_enabled): ?>
                <!-- Main Character Button (always visible, separate from personas) -->
                <div class="aicpp-main-char-btn" id="main-char-btn-<?php echo esc_attr($sid); ?>" style="padding:12px 16px;background:linear-gradient(135deg,<?php echo esc_attr($main_color); ?>,#764ba2);color:#fff;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:2px solid #e5e7eb;transition:all 0.2s">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0"><?php echo esc_html(mb_strtoupper(mb_substr($main_initials, 0, 2))); ?></div>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:14px;font-weight:700"><?php echo esc_html($main_name); ?></div>
                        <div style="font-size:11px;opacity:0.8">Main Site Assistant</div>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Persona section header -->
                <div style="padding:10px 16px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">
                    &#x1F3AD; My Personas
                </div>

                <!-- Persona selector -->
                <div class="aicpp-persona-selector" id="persona-selector-<?php echo esc_attr($sid); ?>">
                    <div class="aicpp-loading">Loading personas...</div>
                </div>

                <!-- Conversation list -->
                <div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">
                    &#x1F4AC; History
                </div>
                <div class="aicpp-conversations-list" id="convos-<?php echo esc_attr($sid); ?>">
                    <div class="aicpp-loading">Loading...</div>
                </div>

                <div class="aicpp-sidebar-footer">
                    <p style="font-size:13px;color:#6b7280;margin:0">Welcome, <?php echo esc_html($user->display_name); ?></p>
                    <a href="<?php echo esc_url(wp_logout_url(get_permalink())); ?>" style="font-size:12px;color:#9ca3af">Sign out</a>
                </div>
            </div>
            <?php endif; ?>

            <!-- Chat area -->
            <div class="aicpp-chat-container">
                <div class="aicpp-header" id="header-<?php echo esc_attr($sid); ?>">
                    <?php if ($show_history): ?>
                    <button class="aicpp-toggle-sidebar" id="toggle-<?php echo esc_attr($sid); ?>">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <?php endif; ?>
                    <div class="aicpp-avatar" id="avatar-<?php echo esc_attr($sid); ?>" style="background:<?php echo $main_enabled ? esc_attr($main_color) : '#667eea'; ?>"><span><?php echo $main_enabled ? esc_html(mb_strtoupper(mb_substr($main_initials, 0, 2))) : 'AI'; ?></span></div>
                    <div class="aicpp-header-info">
                        <h3 id="title-<?php echo esc_attr($sid); ?>"><?php echo $main_enabled ? esc_html($main_name) : 'Select an Assistant'; ?></h3>
                        <span class="aicpp-status"><span class="aicpp-status-dot"></span> Online</span>
                    </div>
                    <button class="aicpp-clear-btn" id="clear-<?php echo esc_attr($sid); ?>" title="Clear conversation">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>

                <div class="aicpp-messages" id="msgs-<?php echo esc_attr($sid); ?>">
                    <div class="aicpp-welcome">
                        <div class="aicpp-welcome-icon" style="font-size:48px">&#x1F4AC;</div>
                        <h4>Welcome, <?php echo esc_html($user->display_name); ?>!</h4>
                        <?php if ($main_enabled): ?>
                            <p>Start chatting with <strong><?php echo esc_html($main_name); ?></strong>, or select a persona from the sidebar.</p>
                        <?php else: ?>
                            <p>Select an assistant from the sidebar to begin chatting.</p>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="aicpp-input-wrapper">
                    <div class="aicpp-file-preview" id="preview-<?php echo esc_attr($sid); ?>" style="display:none"></div>
                    <div class="aicpp-input-container">
                        <div class="aicpp-input-actions">
                            <?php if ($allow_upload): ?>
                            <button class="aicpp-action-btn" id="upload-btn-<?php echo esc_attr($sid); ?>" title="Upload file">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                            </button>
                            <input type="file" id="file-<?php echo esc_attr($sid); ?>" accept="image/*,.pdf,.txt" style="display:none">
                            <?php endif; ?>
                            <?php if ($allow_voice): ?>
                            <button class="aicpp-action-btn" id="voice-btn-<?php echo esc_attr($sid); ?>" title="Voice input">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                            </button>
                            <?php endif; ?>
                        </div>
                        <textarea id="inp-<?php echo esc_attr($sid); ?>" class="aicpp-input" placeholder="<?php echo $main_enabled ? 'Type your message to ' . esc_attr($main_name) . '...' : 'Select an assistant first...'; ?>" rows="1" <?php echo $main_enabled ? '' : 'disabled'; ?>></textarea>
                        <button id="btn-<?php echo esc_attr($sid); ?>" class="aicpp-send-btn" title="Send message" <?php echo $main_enabled ? '' : 'disabled'; ?>>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                    <div class="aicpp-footer-text">Powered by <strong><?php echo esc_html(ucfirst(get_option('aicpp_api_provider', 'OpenAI'))); ?></strong></div>
                </div>
            </div>
        </div>

        <script>
        (function(){
            "use strict";

            var sid = <?php echo wp_json_encode($sid); ?>;
            var ajaxurl = <?php echo wp_json_encode($ajaxurl); ?>;
            var chatNonce = <?php echo wp_json_encode($chat_nonce); ?>;
            var mainEnabled = <?php echo wp_json_encode($main_enabled); ?>;

            var container = document.getElementById('msgs-' + sid);
            var input = document.getElementById('inp-' + sid);
            var btn = document.getElementById('btn-' + sid);
            var clearBtn = document.getElementById('clear-' + sid);
            var previewEl = document.getElementById('preview-' + sid);
            var avatarEl = document.getElementById('avatar-' + sid);
            var titleEl = document.getElementById('title-' + sid);

            var currentSessionId = sid;
            var currentPersonaId = null;
            var currentConvoId = null;
            var isMainChat = mainEnabled; // Start in main chat mode if enabled
            var uploadedFile = null;
            var personas = [];
            var mainCharacter = null;
            var mediaRecorder = null;
            var audioChunks = [];

            function escapeHtml(t){ var d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }
            function formatMessage(t){ t=escapeHtml(t); t=t.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>'); t=t.replace(/`([^`]+)`/g,'<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px">$1</code>'); t=t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>'); t=t.replace(/\n/g,'<br>'); return t; }
            function getTime(){ return new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }

            function addMessage(text, isUser, attachment){
                var w=container.querySelector('.aicpp-welcome'); if(w)w.remove();
                var div=document.createElement('div'); div.className='aicpp-message '+(isUser?'user':'assistant');
                var content=document.createElement('div'); content.className='aicpp-message-content';
                if(attachment){var a=document.createElement('div');a.className='aicpp-message-attachment';if(attachment.file_type&&attachment.file_type.indexOf('image/')===0){a.innerHTML='<img src="'+escapeHtml(attachment.file_url)+'">';}else{a.className+=' file';a.textContent=attachment.file_name;}content.appendChild(a);}
                var td=document.createElement('div');td.innerHTML=formatMessage(text);content.appendChild(td);
                var tm=document.createElement('div');tm.className='aicpp-message-time';tm.textContent=getTime();content.appendChild(tm);
                div.appendChild(content);container.appendChild(div);container.scrollTop=container.scrollHeight;
            }

            function showTyping(){var d=document.createElement('div');d.className='aicpp-message assistant';d.id='typing-'+sid;d.innerHTML='<div class="aicpp-typing"><span></span><span></span><span></span></div>';container.appendChild(d);container.scrollTop=container.scrollHeight;}
            function hideTyping(){var t=document.getElementById('typing-'+sid);if(t)t.remove();}
            function autoResize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px';}
            input.addEventListener('input', autoResize);

            // ---- Load Personas ----
            function loadPersonas(){
                var fd=new FormData();
                fd.append('action','aicpp_get_my_personas');
                fd.append('nonce',chatNonce);
                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){
                    if(d.success){
                        personas = d.data.personas;
                        mainCharacter = d.data.main_character;
                        renderPersonaSelector();
                        // If main character is enabled, start in main chat mode
                        if (mainCharacter) {
                            activateMainChat();
                        } else if (personas.length === 1) {
                            selectPersona(personas[0]);
                        }
                    } else {
                        var sel=document.getElementById('persona-selector-'+sid);
                        if(sel)sel.innerHTML='<div class="aicpp-empty" style="padding:20px;text-align:center;font-size:13px;color:#9ca3af">'+escapeHtml(d.data.message || 'No assistants available.')+'</div>';
                    }
                });
            }

            function renderPersonaSelector(){
                var sel=document.getElementById('persona-selector-'+sid);
                if(!sel)return;
                if(personas.length===0){sel.innerHTML='<div class="aicpp-empty" style="padding:15px;text-align:center;font-size:12px;color:#9ca3af">No personas assigned yet.</div>';return;}
                sel.innerHTML = personas.map(function(p){
                    var badge = p.visibility === 'public' ? '<span style="font-size:9px;background:#228be6;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px">PUBLIC</span>' : '';
                    return '<div class="aicpp-persona-item'+(currentPersonaId==p.id && !isMainChat?' active':'')+'" data-id="'+p.id+'" style="display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-bottom:1px solid #e5e7eb;transition:all 0.2s">'
                        +'<div style="width:36px;height:36px;border-radius:50%;background:'+escapeHtml(p.avatar_color)+';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">'+escapeHtml(p.avatar_initials)+'</div>'
                        +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(p.name)+badge+'</div>'
                        +'<div style="font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(p.description||p.model)+'</div></div></div>';
                }).join('');

                sel.querySelectorAll('.aicpp-persona-item').forEach(function(item){
                    item.addEventListener('click',function(){
                        var id=parseInt(this.dataset.id);
                        var p=personas.find(function(x){return x.id===id});
                        if(p)selectPersona(p);
                    });
                    item.addEventListener('mouseenter',function(){if(!this.classList.contains('active'))this.style.background='#f3f4f6';});
                    item.addEventListener('mouseleave',function(){if(!this.classList.contains('active'))this.style.background='';});
                });
            }

            function activateMainChat(){
                isMainChat = true;
                currentPersonaId = null;
                if (mainCharacter) {
                    titleEl.textContent = mainCharacter.name;
                    avatarEl.style.background = mainCharacter.avatar_color;
                    avatarEl.querySelector('span').textContent = mainCharacter.avatar_initials;
                    input.disabled = false;
                    input.placeholder = 'Type your message to ' + mainCharacter.name + '...';
                    btn.disabled = false;
                }
                // Highlight main char button, unhighlight personas
                var mainBtn = document.getElementById('main-char-btn-' + sid);
                if (mainBtn) mainBtn.style.opacity = '1';
                var sel = document.getElementById('persona-selector-' + sid);
                if (sel) sel.querySelectorAll('.aicpp-persona-item').forEach(function(item){
                    item.classList.remove('active'); item.style.background=''; item.style.borderLeft='';
                });
                clearChat(true);
                loadConversations();
                input.focus();
            }

            function selectPersona(p){
                isMainChat = false;
                currentPersonaId = p.id;
                titleEl.textContent = p.name;
                avatarEl.style.background = p.avatar_color;
                avatarEl.querySelector('span').textContent = p.avatar_initials;
                input.disabled = false;
                input.placeholder = 'Type your message to '+p.name+'...';
                btn.disabled = false;
                clearChat(true);

                // Highlight in selector, dim main char
                var mainBtn = document.getElementById('main-char-btn-' + sid);
                if (mainBtn) mainBtn.style.opacity = '0.6';
                var sel=document.getElementById('persona-selector-'+sid);
                if(sel){
                    sel.querySelectorAll('.aicpp-persona-item').forEach(function(item){
                        if(parseInt(item.dataset.id)===p.id){item.classList.add('active');item.style.background='#eef2ff';item.style.borderLeft='3px solid #667eea';}
                        else{item.classList.remove('active');item.style.background='';item.style.borderLeft='';}
                    });
                }

                loadConversations();
                input.focus();
            }

            function clearChat(silent){
                currentConvoId = null;
                currentSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
                uploadedFile = null;
                if(previewEl)previewEl.style.display='none';
                var chatName = isMainChat ? (mainCharacter ? mainCharacter.name : 'Assistant') : (currentPersonaId ? (personas.find(function(x){return x.id===currentPersonaId})||{}).name||'Assistant' : 'an assistant');
                container.innerHTML='<div class="aicpp-welcome"><div class="aicpp-welcome-icon" style="font-size:48px">&#x1F4AC;</div><h4>Chat with '+escapeHtml(chatName)+'</h4><p>Start a new conversation</p></div>';
                if(!silent){
                    var convos=document.getElementById('convos-'+sid);
                    if(convos)convos.querySelectorAll('.aicpp-convo-item').forEach(function(i){i.classList.remove('active');});
                }
            }

            // Main character click handler
            var mainCharBtn = document.getElementById('main-char-btn-' + sid);
            if (mainCharBtn) {
                mainCharBtn.addEventListener('click', function(){ activateMainChat(); });
            }

            // ---- Conversations ----
            <?php if ($show_history): ?>
            var sidebar=document.getElementById('sidebar-'+sid);
            var convosList=document.getElementById('convos-'+sid);
            var newBtn=document.getElementById('new-'+sid);
            var toggleBtn=document.getElementById('toggle-'+sid);

            function loadConversations(){
                var fd=new FormData();fd.append('action','aicpp_get_conversations');fd.append('nonce',chatNonce);fd.append('session_id',currentSessionId);
                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){
                    if(d.success){
                        var filtered;
                        if (isMainChat) {
                            filtered = d.data.conversations.filter(function(c){ return c.is_main_chat == 1 || c.is_main_chat == '1'; });
                        } else if (currentPersonaId) {
                            filtered = d.data.conversations.filter(function(c){ return c.persona_id == currentPersonaId && c.is_main_chat != 1 && c.is_main_chat != '1'; });
                        } else {
                            filtered = d.data.conversations;
                        }
                        renderConversations(filtered);
                    }
                });
            }

            function renderConversations(convos){
                if(convos.length===0){convosList.innerHTML='<div class="aicpp-loading" style="font-size:13px">No conversations yet</div>';return;}
                convosList.innerHTML=convos.map(function(c){
                    return '<div class="aicpp-convo-item'+(currentConvoId==c.id?' active':'')+'" data-id="'+c.id+'" data-main="'+(c.is_main_chat||0)+'">'
                        +'<div class="aicpp-convo-title">'+escapeHtml(c.title)+'</div>'
                        +'<div class="aicpp-convo-meta"><span>'+new Date(c.updated_at).toLocaleDateString()+'</span></div>'
                        +'<div class="aicpp-convo-actions"><button class="aicpp-convo-btn load-convo">Load</button><button class="aicpp-convo-btn delete-convo">Delete</button></div></div>';
                }).join('');
                convosList.querySelectorAll('.load-convo').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();loadConversation(this.closest('.aicpp-convo-item').dataset.id);});});
                convosList.querySelectorAll('.delete-convo').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();deleteConversation(this.closest('.aicpp-convo-item').dataset.id);});});
            }

            function loadConversation(id){
                var fd=new FormData();fd.append('action','aicpp_load_conversation');fd.append('nonce',chatNonce);fd.append('conversation_id',id);fd.append('session_id',currentSessionId);
                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){
                    if(d.success){
                        currentSessionId=d.data.session_id;currentConvoId=id;
                        container.innerHTML='';
                        d.data.messages.forEach(function(m){addMessage(m.content,m.role==='user');});
                        convosList.querySelectorAll('.aicpp-convo-item').forEach(function(i){i.classList.toggle('active',i.dataset.id==id);});
                    }
                });
            }

            function deleteConversation(id){
                if(!confirm('Delete?'))return;
                var fd=new FormData();fd.append('action','aicpp_delete_conversation');fd.append('nonce',chatNonce);fd.append('conversation_id',id);fd.append('session_id',currentSessionId);
                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){if(d.success){loadConversations();if(currentConvoId==id)clearChat();}});
            }

            newBtn.addEventListener('click',function(){clearChat();});
            toggleBtn.addEventListener('click',function(){sidebar.classList.toggle('hidden');});
            <?php endif; ?>

            // ---- Upload ----
            <?php if ($allow_upload): ?>
            var uploadBtn=document.getElementById('upload-btn-'+sid),fileInput=document.getElementById('file-'+sid);
            uploadBtn.addEventListener('click',function(){fileInput.click();});
            fileInput.addEventListener('change',function(){
                if(!this.files.length)return;
                var fd=new FormData();fd.append('action','aicpp_upload_file');fd.append('nonce',chatNonce);fd.append('file',this.files[0]);
                previewEl.style.display='block';previewEl.innerHTML='<div style="text-align:center;padding:12px">Uploading...</div>';
                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){
                    if(d.success){
                        uploadedFile=d.data;
                        var html='<div class="aicpp-file-preview-item">';
                        if(d.data.file_type&&d.data.file_type.indexOf('image/')===0)html+='<img src="'+escapeHtml(d.data.file_url)+'" style="width:60px;height:60px;object-fit:cover;border-radius:8px">';
                        html+='<div style="flex:1">'+escapeHtml(d.data.file_name)+'</div><button class="aicpp-remove-file" style="padding:4px 8px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer">Remove</button></div>';
                        previewEl.innerHTML=html;
                        previewEl.querySelector('.aicpp-remove-file').addEventListener('click',function(){uploadedFile=null;previewEl.style.display='none';});
                    }else{previewEl.innerHTML='<div style="color:#ef4444;padding:12px">'+escapeHtml(d.data.message)+'</div>';setTimeout(function(){previewEl.style.display='none';},3000);}
                });
                this.value='';
            });
            <?php endif; ?>

            // ---- Voice ----
            <?php if ($allow_voice): ?>
            var voiceBtn=document.getElementById('voice-btn-'+sid);
            function startRec(){navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){mediaRecorder=new MediaRecorder(s);audioChunks=[];mediaRecorder.ondataavailable=function(e){audioChunks.push(e.data);};mediaRecorder.onstop=function(){var b=new Blob(audioChunks,{type:'audio/webm'});transcribeAudio(b);s.getTracks().forEach(function(t){t.stop();});};mediaRecorder.start();voiceBtn.classList.add('recording');}).catch(function(){alert('Microphone denied');});}
            function stopRec(){if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();voiceBtn.classList.remove('recording');}}
            function transcribeAudio(blob){var fd=new FormData();fd.append('action','aicpp_transcribe_audio');fd.append('nonce',chatNonce);fd.append('audio',blob,'recording.webm');input.placeholder='Transcribing...';btn.disabled=true;fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(d){if(d.success){input.value=d.data.text;input.focus();autoResize();}else{alert(d.data.message);}input.placeholder='Type your message...';btn.disabled=false;}).catch(function(){alert('Error');input.placeholder='Type your message...';btn.disabled=false;});}
            voiceBtn.addEventListener('mousedown',startRec);voiceBtn.addEventListener('mouseup',stopRec);
            voiceBtn.addEventListener('touchstart',function(e){e.preventDefault();startRec();});voiceBtn.addEventListener('touchend',function(e){e.preventDefault();stopRec();});
            <?php endif; ?>

            // ---- Send ----
            function send(){
                var message=input.value.trim();
                if(!message||btn.disabled)return;
                // Must be in main chat mode or have a persona selected
                if(!isMainChat && !currentPersonaId) return;

                var attachment=uploadedFile;
                addMessage(message,true,attachment);
                input.value='';input.style.height='auto';btn.disabled=true;showTyping();

                var fd=new FormData();
                // Use different action for main chat vs persona chat
                if (isMainChat) {
                    fd.append('action','aicpp_chat_main');
                } else {
                    fd.append('action','aicpp_chat');
                    fd.append('persona_id',currentPersonaId);
                }
                fd.append('nonce',chatNonce);
                fd.append('message',message);
                fd.append('session_id',currentSessionId);
                if(attachment){fd.append('has_attachment','1');fd.append('attachment_url',attachment.file_url);fd.append('attachment_type',attachment.file_type);if(attachment.file_data)fd.append('attachment_data',attachment.file_data);}

                fetch(ajaxurl,{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(data){
                    hideTyping();
                    if(data.success){addMessage(data.data.message,false);if(data.data.conversation_id)currentConvoId=data.data.conversation_id;<?php if($show_history):?>loadConversations();<?php endif;?>}
                    else{addMessage('Error: '+(data.data.message||'Unknown'),false);}
                    btn.disabled=false;input.focus();uploadedFile=null;if(previewEl)previewEl.style.display='none';
                }).catch(function(){hideTyping();addMessage('Connection error.',false);btn.disabled=false;input.focus();});
            }

            clearBtn.addEventListener('click',function(){if(confirm('Clear?'))clearChat();});
            btn.addEventListener('click',send);
            input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});

            // Init
            loadPersonas();
        })();
        </script>
        <?php
        return ob_get_clean();
    }

    private function get_frontend_css() {
        return '
        .aicpp-wrapper{display:flex;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:100%;margin:0 auto;position:relative}
        .aicpp-sidebar{width:300px;background:#f9fafb;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;transition:margin-left 0.3s}.aicpp-sidebar.hidden{margin-left:-300px}
        .aicpp-sidebar-header{padding:16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb}.aicpp-sidebar-header h3{margin:0;font-size:16px;color:#111827}
        .aicpp-new-chat{width:36px;height:36px;border-radius:8px;border:2px solid #667eea;background:#fff;color:#667eea;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}.aicpp-new-chat:hover{background:#667eea;color:#fff}
        .aicpp-persona-selector{border-bottom:1px solid #e5e7eb;max-height:200px;overflow-y:auto}
        .aicpp-persona-item.active{background:#eef2ff !important;border-left:3px solid #667eea !important}
        .aicpp-conversations-list{flex:1;overflow-y:auto;padding:8px}
        .aicpp-convo-item{padding:10px 12px;border-radius:8px;margin-bottom:4px;cursor:pointer;transition:all 0.2s;border:1px solid transparent}.aicpp-convo-item:hover{background:#fff;border-color:#e5e7eb}.aicpp-convo-item.active{background:#667eea;color:#fff}
        .aicpp-convo-title{font-size:13px;font-weight:500;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aicpp-convo-meta{font-size:11px;opacity:0.7}
        .aicpp-convo-actions{display:none;gap:8px;margin-top:6px}.aicpp-convo-item:hover .aicpp-convo-actions{display:flex}.aicpp-convo-btn{font-size:11px;padding:3px 8px;border:1px solid #e5e7eb;background:#fff;border-radius:4px;cursor:pointer}.aicpp-convo-btn:hover{background:#f3f4f6}
        .aicpp-loading{text-align:center;padding:20px;color:#9ca3af;font-size:13px}
        .aicpp-sidebar-footer{border-top:1px solid #e5e7eb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
        .aicpp-chat-container{flex:1;display:flex;flex-direction:column;min-width:0}
        .aicpp-header{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff}
        .aicpp-toggle-sidebar{width:36px;height:36px;border-radius:8px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}.aicpp-toggle-sidebar:hover{background:rgba(255,255,255,0.25)}
        .aicpp-avatar{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;color:#fff}
        .aicpp-header-info{flex:1;min-width:0}.aicpp-header-info h3{margin:0;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .aicpp-status{display:flex;align-items:center;gap:6px;font-size:13px;opacity:0.9;margin-top:2px}.aicpp-status-dot{width:8px;height:8px;background:#4ade80;border-radius:50%;animation:aicpp-pulse 2s ease-in-out infinite}@keyframes aicpp-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .aicpp-clear-btn{width:36px;height:36px;border-radius:8px;border:none;background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}.aicpp-clear-btn:hover{background:rgba(255,255,255,0.25)}
        .aicpp-messages{flex:1;overflow-y:auto;padding:20px;background:#f9fafb;scroll-behavior:smooth}
        .aicpp-welcome{text-align:center;padding:40px 20px;color:#6b7280}.aicpp-welcome h4{font-size:20px;color:#111827;margin:0 0 8px}.aicpp-welcome p{margin:0;font-size:14px}
        .aicpp-message{display:flex;margin-bottom:16px;animation:aicpp-fadeIn 0.3s ease-in}@keyframes aicpp-fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.aicpp-message.user{justify-content:flex-end}
        .aicpp-message-content{max-width:75%;padding:12px 16px;border-radius:16px;line-height:1.5;font-size:14px}
        .aicpp-message.user .aicpp-message-content{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-bottom-right-radius:4px}
        .aicpp-message.assistant .aicpp-message-content{background:#fff;color:#111827;border:1px solid #e5e7eb;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}
        .aicpp-message-time{font-size:11px;opacity:0.6;margin-top:4px}
        .aicpp-message-attachment{max-width:300px;margin:8px 0;border-radius:8px;overflow:hidden}.aicpp-message-attachment img{width:100%;display:block}.aicpp-message-attachment.file{padding:12px;background:rgba(0,0,0,0.05);display:flex;align-items:center;gap:8px}
        .aicpp-typing{display:inline-flex;gap:4px;padding:12px 16px;background:#fff;border-radius:16px;border-bottom-left-radius:4px;border:1px solid #e5e7eb}.aicpp-typing span{width:8px;height:8px;background:#667eea;border-radius:50%;animation:aicpp-bounce 1.4s ease-in-out infinite}.aicpp-typing span:nth-child(2){animation-delay:0.2s}.aicpp-typing span:nth-child(3){animation-delay:0.4s}@keyframes aicpp-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}
        .aicpp-input-wrapper{background:#fff;border-top:1px solid #e5e7eb;padding:16px 20px}
        .aicpp-file-preview{padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:12px}.aicpp-file-preview-item{display:flex;align-items:center;gap:12px}
        .aicpp-input-container{display:flex;gap:12px;align-items:flex-end;background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:8px 12px;transition:border-color 0.2s}.aicpp-input-container:focus-within{border-color:#667eea;background:#fff}
        .aicpp-input-actions{display:flex;gap:4px;align-items:center}.aicpp-action-btn{width:32px;height:32px;border-radius:6px;border:none;background:transparent;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}.aicpp-action-btn:hover{background:#e5e7eb;color:#111827}.aicpp-action-btn.recording{background:#ef4444;color:#fff;animation:aicpp-pulse-btn 1s ease-in-out infinite}@keyframes aicpp-pulse-btn{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        .aicpp-input{flex:1;border:none;background:transparent;outline:none;resize:none;font-family:inherit;font-size:14px;line-height:1.5;max-height:120px;color:#111827}.aicpp-input::placeholder{color:#9ca3af}
        .aicpp-send-btn{width:36px;height:36px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}.aicpp-send-btn:hover:not(:disabled){transform:scale(1.05);box-shadow:0 4px 12px rgba(102,126,234,0.4)}.aicpp-send-btn:disabled{opacity:0.5;cursor:not-allowed}
        .aicpp-footer-text{text-align:center;font-size:12px;color:#9ca3af;margin-top:8px}
        .aicpp-message-content pre{background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px}.aicpp-message-content code{font-family:"Courier New",monospace}.aicpp-message-content p{margin:0 0 8px}.aicpp-message-content p:last-child{margin-bottom:0}
        .aicpp-auth-wrapper{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
        .aicpp-auth-box{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden}
        .aicpp-auth-header{text-align:center;padding:30px 30px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff}
        .aicpp-auth-header h2{margin:0 0 8px;font-size:22px}.aicpp-auth-header p{margin:0;opacity:0.9;font-size:14px}
        .aicpp-auth-tab{padding:24px 30px 30px}
        .aicpp-auth-field{margin-bottom:16px}.aicpp-auth-field label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px}.aicpp-auth-field input{width:100%;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;transition:border-color 0.2s;box-sizing:border-box}.aicpp-auth-field input:focus{border-color:#667eea;outline:none}
        .aicpp-auth-submit{width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.2s;margin-top:8px}.aicpp-auth-submit:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(102,126,234,0.4)}.aicpp-auth-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .aicpp-auth-switch{text-align:center;font-size:14px;color:#6b7280;margin:16px 0 0}.aicpp-auth-switch a{color:#667eea;text-decoration:none;font-weight:600}.aicpp-auth-switch a:hover{text-decoration:underline}
        .aicpp-auth-msg{padding:10px;border-radius:8px;margin-bottom:12px;font-size:13px}.aicpp-auth-msg.success{background:#d3f9d8;color:#2b8a3e}.aicpp-auth-msg.error{background:#ffe3e3;color:#c92a2a}
        .aicpp-main-char-btn:hover{opacity:0.9!important}
        @media(max-width:768px){.aicpp-sidebar{position:absolute;height:100%;z-index:10;box-shadow:2px 0 8px rgba(0,0,0,0.1)}.aicpp-message-content{max-width:85%}}
        ';
    }
}

AI_Chat_Persona_Pro_Ultimate::get_instance();