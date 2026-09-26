<?php
/**
 * Plugin Name: Premium URL Shortener
 * Plugin URI:  https://github.com/premium-url-shortener
 * Description: Shorten links with your own Premium URL Shortener installation: automatic short links for published posts, a [shortlink] shortcode and branded wp_get_shortlink() URLs.
 * Version:     1.0.0
 * Author:      Premium URL Shortener
 * License:     GPL-2.0-or-later
 * Text Domain: premium-url-shortener
 *
 * Settings → Premium URL Shortener: enter your site URL (https://sho.rt) and an API key with `links.write`.
 */

if (!defined('ABSPATH')) exit;

final class Premium_URL_Shortener_Plugin
{
    const OPTION = 'pus_settings';
    const META   = '_pus_short_url';
    const META_ID = '_pus_link_id';

    /** @var Premium_URL_Shortener_Plugin|null */
    private static $instance = null;

    public static function instance(): self
    {
        if (self::$instance === null) self::$instance = new self();
        return self::$instance;
    }

    private function __construct()
    {
        add_action('admin_menu', [$this, 'admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_shortcode('shortlink', [$this, 'shortcode']);
        add_filter('pre_get_shortlink', [$this, 'filter_shortlink'], 10, 4);
        add_action('transition_post_status', [$this, 'on_publish'], 10, 3);
        add_action('add_meta_boxes', [$this, 'meta_box']);
        add_action('wp_ajax_pus_shorten_post', [$this, 'ajax_shorten_post']);
        add_action('admin_notices', [$this, 'admin_notices']);
    }

    // ------------------------------------------------------------------ settings

    public function settings(): array
    {
        $defaults = ['site_url' => '', 'api_key' => '', 'auto_shorten' => 1, 'post_types' => ['post', 'page'], 'domain' => '', 'replace_shortlink' => 1];
        return wp_parse_args((array) get_option(self::OPTION, []), $defaults);
    }

    public function admin_menu(): void
    {
        add_options_page(__('Premium URL Shortener', 'premium-url-shortener'), __('URL Shortener', 'premium-url-shortener'), 'manage_options', 'premium-url-shortener', [$this, 'settings_page']);
    }

    public function register_settings(): void
    {
        register_setting('pus_settings_group', self::OPTION, ['sanitize_callback' => [$this, 'sanitize']]);
    }

    public function sanitize($input): array
    {
        $input = (array) $input;
        return [
            'site_url'          => rtrim(esc_url_raw(trim($input['site_url'] ?? '')), '/'),
            'api_key'           => sanitize_text_field($input['api_key'] ?? ''),
            'auto_shorten'      => empty($input['auto_shorten']) ? 0 : 1,
            'replace_shortlink' => empty($input['replace_shortlink']) ? 0 : 1,
            'domain'            => sanitize_text_field($input['domain'] ?? ''),
            'post_types'        => array_map('sanitize_key', (array) ($input['post_types'] ?? ['post'])),
        ];
    }

    public function settings_page(): void
    {
        if (!current_user_can('manage_options')) return;
        $s = $this->settings();
        $types = get_post_types(['public' => true], 'objects');
        $test = null;
        if (isset($_GET['pus_test']) && check_admin_referer('pus_test')) $test = $this->request('GET', '/api/v1/account');
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Premium URL Shortener', 'premium-url-shortener'); ?></h1>
            <?php if ($test !== null): ?>
                <?php if (is_wp_error($test)): ?>
                    <div class="notice notice-error"><p><?php echo esc_html($test->get_error_message()); ?></p></div>
                <?php else: ?>
                    <div class="notice notice-success"><p><?php printf(esc_html__('Connected as %s (%s plan).', 'premium-url-shortener'), esc_html($test['data']['username'] ?? '?'), esc_html($test['data']['plan']['name'] ?? 'free')); ?></p></div>
                <?php endif; ?>
            <?php endif; ?>
            <form method="post" action="options.php">
                <?php settings_fields('pus_settings_group'); ?>
                <table class="form-table" role="presentation">
                    <tr><th scope="row"><label for="pus_site_url"><?php esc_html_e('Shortener URL', 'premium-url-shortener'); ?></label></th>
                        <td><input id="pus_site_url" name="<?php echo self::OPTION; ?>[site_url]" type="url" class="regular-text" placeholder="https://sho.rt" value="<?php echo esc_attr($s['site_url']); ?>" />
                        <p class="description"><?php esc_html_e('The address of your Premium URL Shortener installation.', 'premium-url-shortener'); ?></p></td></tr>
                    <tr><th scope="row"><label for="pus_api_key"><?php esc_html_e('API key', 'premium-url-shortener'); ?></label></th>
                        <td><input id="pus_api_key" name="<?php echo self::OPTION; ?>[api_key]" type="password" class="regular-text" value="<?php echo esc_attr($s['api_key']); ?>" autocomplete="off" />
                        <p class="description"><?php esc_html_e('Create a key under Dashboard → Settings → API (permission links.write).', 'premium-url-shortener'); ?></p></td></tr>
                    <tr><th scope="row"><label for="pus_domain"><?php esc_html_e('Domain (optional)', 'premium-url-shortener'); ?></label></th>
                        <td><input id="pus_domain" name="<?php echo self::OPTION; ?>[domain]" type="text" class="regular-text" placeholder="go.example.com" value="<?php echo esc_attr($s['domain']); ?>" />
                        <p class="description"><?php esc_html_e('Custom domain (id or hostname) to create links on. Leave empty for the main domain.', 'premium-url-shortener'); ?></p></td></tr>
                    <tr><th scope="row"><?php esc_html_e('Automation', 'premium-url-shortener'); ?></th>
                        <td><label><input type="checkbox" name="<?php echo self::OPTION; ?>[auto_shorten]" value="1" <?php checked($s['auto_shorten'], 1); ?> /> <?php esc_html_e('Automatically create a short link when a post is published', 'premium-url-shortener'); ?></label><br/>
                            <label><input type="checkbox" name="<?php echo self::OPTION; ?>[replace_shortlink]" value="1" <?php checked($s['replace_shortlink'], 1); ?> /> <?php esc_html_e('Use the short link for wp_get_shortlink() (Get Shortlink button, rel=shortlink tag)', 'premium-url-shortener'); ?></label></td></tr>
                    <tr><th scope="row"><?php esc_html_e('Post types', 'premium-url-shortener'); ?></th>
                        <td><?php foreach ($types as $t): ?>
                            <label style="margin-right:12px"><input type="checkbox" name="<?php echo self::OPTION; ?>[post_types][]" value="<?php echo esc_attr($t->name); ?>" <?php checked(in_array($t->name, (array) $s['post_types'], true)); ?> /> <?php echo esc_html($t->labels->singular_name); ?></label>
                        <?php endforeach; ?></td></tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <p><a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('options-general.php?page=premium-url-shortener&pus_test=1'), 'pus_test')); ?>"><?php esc_html_e('Test connection', 'premium-url-shortener'); ?></a></p>
            <h2><?php esc_html_e('Usage', 'premium-url-shortener'); ?></h2>
            <ul style="list-style:disc;padding-left:20px">
                <li><code>[shortlink url="https://example.com/page"]</code> — <?php esc_html_e('outputs a short link for any URL.', 'premium-url-shortener'); ?></li>
                <li><code>[shortlink]</code> — <?php esc_html_e('outputs the short link of the current post (created on demand).', 'premium-url-shortener'); ?></li>
                <li><code>[shortlink url="..." alias="promo" text="Click here"]</code> — <?php esc_html_e('custom alias and anchor text (renders an <a> tag).', 'premium-url-shortener'); ?></li>
                <li><code>&lt;?php echo pus_shorten('https://example.com'); ?&gt;</code> — <?php esc_html_e('template function.', 'premium-url-shortener'); ?></li>
            </ul>
        </div>
        <?php
    }

    public function admin_notices(): void
    {
        $s = $this->settings();
        if (current_user_can('manage_options') && (!$s['site_url'] || !$s['api_key']) && (get_current_screen()->id ?? '') !== 'settings_page_premium-url-shortener') {
            printf('<div class="notice notice-warning is-dismissible"><p>%s <a href="%s">%s</a></p></div>', esc_html__('Premium URL Shortener is not configured yet.', 'premium-url-shortener'), esc_url(admin_url('options-general.php?page=premium-url-shortener')), esc_html__('Open settings', 'premium-url-shortener'));
        }
    }

    // ------------------------------------------------------------------ API

    /**
     * @return array|WP_Error decoded JSON envelope
     */
    public function request(string $method, string $path, array $body = null)
    {
        $s = $this->settings();
        if (!$s['site_url'] || !$s['api_key']) return new WP_Error('pus_not_configured', __('Premium URL Shortener is not configured.', 'premium-url-shortener'));
        $args = [
            'method'  => $method,
            'timeout' => 15,
            'headers' => ['Authorization' => 'Bearer ' . $s['api_key'], 'Accept' => 'application/json', 'Content-Type' => 'application/json', 'User-Agent' => 'PremiumURLShortener-WordPress/1.0'],
        ];
        if ($body !== null) $args['body'] = wp_json_encode($body);
        $res = $method === 'GET' ? wp_remote_get($s['site_url'] . $path, $args) : wp_remote_post($s['site_url'] . $path, $args);
        if (is_wp_error($res)) return $res;
        $json = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($json)) return new WP_Error('pus_bad_response', __('Invalid response from the shortener.', 'premium-url-shortener'));
        if (!empty($json['error'])) return new WP_Error('pus_api_error', $json['message'] ?? __('API error', 'premium-url-shortener'));
        return $json;
    }

    /** Creates a short link. Returns ['id'=>, 'short'=>] or WP_Error. */
    public function create_link(string $url, array $fields = [])
    {
        $s = $this->settings();
        $body = array_merge(['url' => $url], $fields);
        if ($s['domain'] && empty($body['domain'])) $body['domain'] = $s['domain'];
        $res = $this->request('POST', '/api/v1/links', $body);
        if (is_wp_error($res)) return $res;
        return ['id' => $res['id'] ?? ($res['data']['id'] ?? ''), 'short' => $res['short'] ?? ($res['data']['short'] ?? '')];
    }

    /** Short URL for a post: cached in post meta, created on demand. */
    public function post_short_url(int $post_id, bool $create = true)
    {
        $existing = get_post_meta($post_id, self::META, true);
        if ($existing) return $existing;
        if (!$create) return '';
        $post = get_post($post_id);
        if (!$post || $post->post_status !== 'publish') return '';
        $link = $this->create_link(get_permalink($post_id), ['title' => get_the_title($post_id)]);
        if (is_wp_error($link) || empty($link['short'])) return '';
        update_post_meta($post_id, self::META, $link['short']);
        update_post_meta($post_id, self::META_ID, $link['id']);
        return $link['short'];
    }

    // ------------------------------------------------------------------ hooks

    public function on_publish(string $new, string $old, WP_Post $post): void
    {
        $s = $this->settings();
        if (!$s['auto_shorten'] || $new !== 'publish' || $old === 'publish') return;
        if (!in_array($post->post_type, (array) $s['post_types'], true)) return;
        if (get_post_meta($post->ID, self::META, true)) return;
        $this->post_short_url($post->ID, true);
    }

    /** Serve our short link from wp_get_shortlink(). */
    public function filter_shortlink($shortlink, $id, $context, $allow_slugs)
    {
        $s = $this->settings();
        if (!$s['replace_shortlink']) return $shortlink;
        $post_id = 0;
        if ($context === 'post' && $id) $post_id = (int) $id;
        elseif ($context === 'query' && is_singular()) $post_id = get_queried_object_id();
        if (!$post_id) return $shortlink;
        $short = $this->post_short_url($post_id, false); // never create during rendering
        return $short ?: $shortlink;
    }

    /** [shortlink url="" alias="" text=""] */
    public function shortcode($atts): string
    {
        $atts = shortcode_atts(['url' => '', 'alias' => '', 'text' => '', 'title' => ''], $atts, 'shortlink');
        $short = '';
        if ($atts['url']) {
            $key = 'pus_sc_' . md5($atts['url'] . '|' . $atts['alias']);
            $short = get_transient($key);
            if (!$short) {
                $fields = [];
                if ($atts['alias']) $fields['custom'] = $atts['alias'];
                if ($atts['title']) $fields['title'] = $atts['title'];
                $link = $this->create_link($atts['url'], $fields);
                if (is_wp_error($link)) return current_user_can('edit_posts') ? '<span class="pus-error">' . esc_html($link->get_error_message()) . '</span>' : esc_url($atts['url']);
                $short = $link['short'];
                set_transient($key, $short, YEAR_IN_SECONDS);
            }
        } else {
            $short = $this->post_short_url(get_the_ID() ?: 0, true);
        }
        if (!$short) return '';
        if ($atts['text']) return sprintf('<a href="%s" class="pus-shortlink">%s</a>', esc_url($short), esc_html($atts['text']));
        return esc_html($short);
    }

    public function meta_box(): void
    {
        foreach ((array) $this->settings()['post_types'] as $type) {
            add_meta_box('pus_shortlink', __('Short link', 'premium-url-shortener'), [$this, 'render_meta_box'], $type, 'side', 'default');
        }
    }

    public function render_meta_box(WP_Post $post): void
    {
        $short = get_post_meta($post->ID, self::META, true);
        $nonce = wp_create_nonce('pus_shorten_' . $post->ID);
        echo '<div id="pus-meta-box" data-post="' . esc_attr($post->ID) . '" data-nonce="' . esc_attr($nonce) . '">';
        if ($short) {
            echo '<input type="text" readonly class="widefat" value="' . esc_attr($short) . '" onclick="this.select()" />';
        } else {
            echo '<p class="description">' . esc_html__('No short link yet.', 'premium-url-shortener') . '</p>';
        }
        if ($post->post_status === 'publish') {
            echo '<p><button type="button" class="button" onclick="(function(b){b.disabled=true;var d=document.getElementById(\'pus-meta-box\');fetch(ajaxurl,{method:\'POST\',credentials:\'same-origin\',headers:{\'Content-Type\':\'application/x-www-form-urlencoded\'},body:\'action=pus_shorten_post&post=\'+d.dataset.post+\'&_wpnonce=\'+d.dataset.nonce+\'&force=1\'}).then(function(r){return r.json()}).then(function(j){if(j.success){d.querySelector(\'input\')?(d.querySelector(\'input\').value=j.data.short):d.insertAdjacentHTML(\'afterbegin\',\'<input type=text readonly class=widefat value=\"\'+j.data.short+\'\">\')}else{alert(j.data||\'Error\')}b.disabled=false})})(this)">' . esc_html($short ? __('Regenerate', 'premium-url-shortener') : __('Create short link', 'premium-url-shortener')) . '</button></p>';
        }
        echo '</div>';
    }

    public function ajax_shorten_post(): void
    {
        $post_id = (int) ($_POST['post'] ?? 0);
        check_ajax_referer('pus_shorten_' . $post_id);
        if (!current_user_can('edit_post', $post_id)) wp_send_json_error(__('Not allowed', 'premium-url-shortener'));
        if (!empty($_POST['force'])) { delete_post_meta($post_id, self::META); delete_post_meta($post_id, self::META_ID); }
        $short = $this->post_short_url($post_id, true);
        if (!$short) wp_send_json_error(__('Could not create the short link. Check the plugin settings.', 'premium-url-shortener'));
        wp_send_json_success(['short' => $short]);
    }
}

Premium_URL_Shortener_Plugin::instance();

if (!function_exists('pus_shorten')) {
    /** Template helper: returns a short URL (or the original URL on failure). */
    function pus_shorten(string $url, array $fields = []): string
    {
        $link = Premium_URL_Shortener_Plugin::instance()->create_link($url, $fields);
        return is_wp_error($link) || empty($link['short']) ? $url : $link['short'];
    }
}
