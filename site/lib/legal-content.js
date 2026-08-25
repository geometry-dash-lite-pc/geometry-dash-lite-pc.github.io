"use strict";

/**
 * Static footer/legal pages, shared verbatim across every game's export
 * (same as the header/footer chrome in render.js). Content lives here as
 * plain HTML strings — trusted, author-written copy, not user input, so it
 * isn't run through escapeHtml like game data is.
 *
 * The contact email is a literal placeholder on purpose (left for the site
 * owner to fill in before launch) — do not replace it with a real address.
 */

const EMAIL = "[YOUR EMAIL HERE]";
const DMCA_EMAIL = "[YOUR DMCA EMAIL HERE]";
const SITE_NAME = "Geometry Dash Lite";
const LAST_UPDATED = "August 26, 2026";

function page(slug, navLabel, title, metaDescription, bodyHtml) {
  return { slug: slug, navLabel: navLabel, title: title, metaDescription: metaDescription, bodyHtml: bodyHtml };
}

const pages = [
  page(
    "about",
    "About Us",
    "About Us",
    "Learn more about " + SITE_NAME + " — a free browser portal for Geometry Dash Lite and other online games.",
    "<h1>About Us</h1>" +
      "<p>" + SITE_NAME + " is an independent website that brings together Geometry Dash Lite and a curated set of other free browser games in one place. Everything on this site runs directly in your browser — no downloads, no installs, no accounts.</p>" +
      "<p>Our goal is simple: make it fast and easy to jump into a game and start playing. We're not affiliated with RobTop Games or any of the original developers behind the titles we feature — we're just fans who built a convenient front door to play them.</p>" +
      "<p>If you have questions, feedback, or a copyright concern, see our <a href=\"contact.html\">Contact Us</a> page.</p>"
  ),
  page(
    "contact",
    "Contact Us",
    "Contact Us",
    "Get in touch with " + SITE_NAME + " for general questions, bug reports, feedback, or copyright concerns.",
    "<h1>Contact Us</h1>" +
      "<h2>General Inquiries and Support</h2>" +
      "<p>Have a question, found a bug, or want to share feedback? Feel free to contact us at <a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a>. We'll do our best to get back to you as soon as possible.</p>" +
      "<h2>Copyright Infringement</h2>" +
      "<p>If you believe content on this website infringes your copyright, please contact us at <a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a>. Please include the relevant details and the URL of the content so we can review your request. See our full <a href=\"dmca.html\">DMCA Policy</a> for what to include.</p>" +
      "<h2>Contact Information</h2>" +
      "<p>Email: <a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a></p>"
  ),
  page(
    "dmca",
    "DMCA",
    "DMCA Copyright Policy",
    "DMCA takedown policy for " + SITE_NAME + ", including how to submit a copyright infringement notice.",
    "<h1>DMCA Copyright Policy</h1>" +
      "<p class=\"muted\">Last updated: " + LAST_UPDATED + "</p>" +
      "<p>We respect the intellectual property rights of copyright owners and expect our users and visitors to do the same.</p>" +
      "<p>If you believe that any content available on " + SITE_NAME + " infringes your copyright, you may submit a DMCA takedown request.</p>" +
      "<h2>Copyright Infringement Notice</h2>" +
      "<p>To submit a copyright infringement complaint, please provide the following information:</p>" +
      "<ul>" +
      "<li>Your full name and contact information.</li>" +
      "<li>Identification of the copyrighted work you believe has been infringed.</li>" +
      "<li>A description of the content you believe infringes your copyright.</li>" +
      "<li>The URL or specific location of the allegedly infringing content.</li>" +
      "<li>A statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>" +
      "<li>A statement that the information in your notice is accurate and that you are authorized to act on behalf of the copyright owner.</li>" +
      "<li>Your physical or electronic signature.</li>" +
      "</ul>" +
      "<h2>DMCA Contact</h2>" +
      "<p>Please send all DMCA notices and copyright-related requests to:</p>" +
      "<p>Email: <a href=\"mailto:" + DMCA_EMAIL + "\">" + DMCA_EMAIL + "</a></p>" +
      "<p>Please include \"DMCA Copyright Notice\" in the subject line of your email.</p>" +
      "<h2>Removal of Content</h2>" +
      "<p>After receiving a valid DMCA notice, we will review the complaint and, where appropriate, remove or disable access to the allegedly infringing material.</p>" +
      "<p>We may also contact the person responsible for the content to inform them about the complaint.</p>" +
      "<h2>Counter-Notification</h2>" +
      "<p>If you believe that content was removed or disabled by mistake or misidentification, you may submit a counter-notification containing appropriate information explaining why the material should be restored.</p>" +
      "<p>We will review valid counter-notifications in accordance with applicable copyright laws.</p>" +
      "<h2>Repeat Infringers</h2>" +
      "<p>We reserve the right to restrict or terminate access to users who repeatedly post or provide content that infringes the copyrights of others.</p>" +
      "<h2>Third-Party Content</h2>" +
      "<p>Some content or links displayed on this website may be provided by third parties. We do not knowingly intend to host or distribute copyrighted material without authorization.</p>" +
      "<p>If you believe that third-party content accessible through our website infringes your copyright, please contact us using the email address above with the relevant details so that we can investigate the matter.</p>" +
      "<h2>Contact</h2>" +
      "<p>For copyright-related questions, DMCA notices, or other concerns, please contact us at:</p>" +
      "<p><a href=\"mailto:" + DMCA_EMAIL + "\">" + DMCA_EMAIL + "</a></p>" +
      "<p>We may update this policy from time to time to reflect changes to our website or applicable laws.</p>"
  ),
  page(
    "privacy-policy",
    "Privacy Policy",
    "Privacy Policy",
    "How " + SITE_NAME + " collects, uses, and protects information, including cookies and analytics.",
    "<h1>Privacy Policy</h1>" +
      "<p class=\"muted\">Last updated: " + LAST_UPDATED + "</p>" +
      "<p>At " + SITE_NAME + ", we value your privacy and want you to feel comfortable using our website. This Privacy Policy explains what information may be collected, how it may be used, and the choices you have when visiting our website.</p>" +
      "<h2>Information We Collect</h2>" +
      "<p>We do not intentionally collect personal information such as your name, home address, phone number, or other identifying information unless you voluntarily provide it to us.</p>" +
      "<p>For example, if you contact us by email, we may receive your email address and any information you choose to include in your message. We use this information only to respond to your request and communicate with you.</p>" +
      "<p>When you visit our website, some basic technical information may also be collected automatically. This can include your IP address, browser type, device type, operating system, pages you visit, and approximate visit times. This information is generally used for website security, analytics, troubleshooting, and improving our services.</p>" +
      "<h2>Cookies and Similar Technologies</h2>" +
      "<p>Our website may use cookies and similar technologies to improve functionality and understand how visitors use the website.</p>" +
      "<p>Cookies are small files stored on your device by your web browser. They can help remember preferences, measure website traffic, and improve your overall browsing experience.</p>" +
      "<p>You can manage or disable cookies through your browser settings. However, disabling certain cookies may affect how some parts of the website work. See our <a href=\"cookies-policy.html\">Cookies Policy</a> for more detail.</p>" +
      "<h2>Advertising</h2>" +
      "<p>We may display advertisements from third-party advertising companies. These companies may use cookies, web beacons, or similar technologies to collect information about your visits to websites in order to provide more relevant advertisements.</p>" +
      "<p>Third-party advertising providers may have their own privacy policies that explain how they collect and use information. We recommend reviewing those policies for more information about their practices.</p>" +
      "<h2>Analytics</h2>" +
      "<p>We may use third-party analytics services to better understand how visitors interact with our website.</p>" +
      "<p>Analytics information may include the pages visitors view, how long they stay on the website, the type of device they use, and general traffic information. We use this information to identify problems, improve website performance, and create a better user experience.</p>" +
      "<p>Analytics services may use cookies or similar technologies to collect this information.</p>" +
      "<h2>Third-Party Websites and Links</h2>" +
      "<p>Our website may contain links to third-party websites, services, or other online resources.</p>" +
      "<p>We are not responsible for the privacy practices, security, content, or policies of third-party websites. Once you leave our website, we recommend checking the privacy policy of the website you visit.</p>" +
      "<h2>Children's Privacy</h2>" +
      "<p>We respect the privacy of children. Our website does not intentionally collect personal information from children.</p>" +
      "<p>If you believe that a child has provided personal information to us without appropriate permission, please contact us. We will review the request and take reasonable steps to remove the information when appropriate.</p>" +
      "<h2>Data Security</h2>" +
      "<p>We take reasonable measures to help protect information that may be collected through our website. However, no website or online service can guarantee complete security.</p>" +
      "<p>For this reason, we encourage visitors not to send sensitive or confidential information through email or other unsecured communication methods.</p>" +
      "<h2>Your Privacy Choices</h2>" +
      "<p>Depending on your location, you may have certain rights regarding your personal information, including the right to request access to, correction of, or deletion of personal information that we may have collected.</p>" +
      "<p>If you would like to make a privacy-related request, please contact us using the email address below.</p>" +
      "<h2>Changes to This Privacy Policy</h2>" +
      "<p>We may update this Privacy Policy from time to time to reflect changes to our website, services, or applicable privacy requirements.</p>" +
      "<p>When we make changes, we will update the \"Last updated\" date at the top of this page. We encourage you to review this page occasionally to stay informed about how we handle information.</p>" +
      "<h2>Contact Us</h2>" +
      "<p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>" +
      "<p><a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a></p>"
  ),
  page(
    "terms-and-conditions",
    "Terms and Conditions",
    "Terms and Conditions",
    "The terms of service governing your use of " + SITE_NAME + ".",
    "<h1>Terms and Conditions</h1>" +
      "<p class=\"muted\">Last updated: " + LAST_UPDATED + "</p>" +
      "<p>Welcome to " + SITE_NAME + ". By accessing or using our website, you agree to these Terms of Service. If you do not agree with these terms, please stop using the website.</p>" +
      "<h2>Use of Our Website</h2>" +
      "<p>You may use our website for personal and non-commercial purposes. You agree to use the website responsibly and in accordance with applicable laws.</p>" +
      "<p>You must not attempt to damage, disrupt, overload, or interfere with the website or its servers. You also agree not to use the website for any unlawful or abusive activity.</p>" +
      "<h2>Game Content</h2>" +
      "<p>Our website provides information and access to online gaming content for entertainment purposes.</p>" +
      "<p>Geometry Dash, its name, graphics, characters, and related trademarks are the property of their respective owners. " + SITE_NAME + " is an independent website and is not affiliated with or endorsed by RobTop Games or Robert Topala.</p>" +
      "<h2>Third-Party Content and Links</h2>" +
      "<p>Our website may include links, advertisements, or content provided by third parties. We do not control these third-party services and are not responsible for their content, availability, security, or privacy practices.</p>" +
      "<p>Any interaction you have with a third-party website or service is between you and that third party.</p>" +
      "<h2>Intellectual Property</h2>" +
      "<p>Unless otherwise stated, the original text, design, and other materials created for this website belong to the website operator.</p>" +
      "<p>If you believe that content on our website infringes your copyright, please contact us so we can review the matter.</p>" +
      "<h2>Website Availability</h2>" +
      "<p>We try to keep the website available and working properly, but we cannot guarantee uninterrupted access. The website may occasionally be unavailable because of maintenance, technical problems, updates, or circumstances beyond our control.</p>" +
      "<p>We may change, suspend, or remove parts of the website at any time without prior notice.</p>" +
      "<h2>Disclaimer of Warranties</h2>" +
      "<p>The website and its content are provided on an \"as is\" and \"as available\" basis.</p>" +
      "<p>We do not guarantee that the website will always be accurate, complete, secure, error-free, or available. Your use of the website is at your own risk.</p>" +
      "<h2>Limitation of Liability</h2>" +
      "<p>To the maximum extent permitted by applicable law, " + SITE_NAME + " and its operators will not be responsible for any direct, indirect, incidental, or consequential loss or damage resulting from your use of, or inability to use, the website or its content.</p>" +
      "<h2>Changes to These Terms</h2>" +
      "<p>We may update these Terms of Service from time to time. Any changes will be posted on this page, and the \"Last updated\" date will be updated accordingly.</p>" +
      "<p>By continuing to use the website after changes are posted, you agree to the updated terms.</p>" +
      "<h2>Contact Us</h2>" +
      "<p>If you have any questions about these Terms of Service, please contact us at:</p>" +
      "<p><a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a></p>"
  ),
  page(
    "cookies-policy",
    "Cookies Policy",
    "Cookies Policy",
    "How " + SITE_NAME + " uses cookies and similar technologies, and how to manage them.",
    "<h1>Cookies Policy</h1>" +
      "<p class=\"muted\">Last updated: " + LAST_UPDATED + "</p>" +
      "<p>At " + SITE_NAME + ", we use cookies and similar technologies to help our website work properly, understand how visitors use it, and improve your overall experience.</p>" +
      "<p>This Cookies Policy explains what cookies are, how we may use them, and what choices you have.</p>" +
      "<h2>What Are Cookies?</h2>" +
      "<p>Cookies are small text files that are stored on your device when you visit a website. They allow websites to remember certain information and can help improve functionality, performance, and the browsing experience.</p>" +
      "<p>Cookies generally do not contain information that directly identifies you.</p>" +
      "<h2>How We Use Cookies</h2>" +
      "<p>We may use cookies for several purposes, including:</p>" +
      "<ul>" +
      "<li><strong>Essential cookies:</strong> Help basic parts of the website function properly.</li>" +
      "<li><strong>Analytics cookies:</strong> Help us understand how visitors use our website, such as which pages are visited and how users interact with them.</li>" +
      "<li><strong>Preference cookies:</strong> May remember certain settings or preferences to make your experience more convenient.</li>" +
      "<li><strong>Advertising cookies:</strong> May be used by advertising partners to provide relevant advertisements and measure advertising performance.</li>" +
      "</ul>" +
      "<h2>Third-Party Cookies</h2>" +
      "<p>Some cookies on our website may be placed by third-party services, such as analytics providers or advertising partners.</p>" +
      "<p>These third parties may use cookies or similar technologies to collect information about your browsing activity. Their use of this information is governed by their own privacy policies.</p>" +
      "<p>We do not control how third-party services manage their cookies, so we recommend reviewing their policies for more information.</p>" +
      "<h2>Managing Cookies</h2>" +
      "<p>Most web browsers allow you to control or delete cookies through their settings.</p>" +
      "<p>You can usually choose to block cookies, delete existing cookies, or receive a notification before a cookie is stored on your device.</p>" +
      "<p>Please note that disabling certain cookies may affect the functionality or performance of some parts of our website.</p>" +
      "<h2>Advertising and Cookies</h2>" +
      "<p>Our website may display advertisements provided by third-party advertising networks. These services may use cookies or similar technologies to personalize advertisements, measure performance, and understand general visitor activity.</p>" +
      "<p>The information collected by advertising providers is handled according to their own privacy policies.</p>" +
      "<h2>Changes to This Cookies Policy</h2>" +
      "<p>We may update this Cookies Policy from time to time if our website, services, or cookie practices change.</p>" +
      "<p>Any updates will be posted on this page with a new \"Last updated\" date.</p>" +
      "<h2>Contact Us</h2>" +
      "<p>If you have questions about this Cookies Policy, please contact us at:</p>" +
      "<p><a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a></p>"
  ),
  page(
    "disclaimer",
    "Disclaimer",
    "Disclaimer",
    "Disclaimer covering the informational content and third-party trademarks referenced on " + SITE_NAME + ".",
    "<h1>Disclaimer</h1>" +
      "<p class=\"muted\">Last updated: " + LAST_UPDATED + "</p>" +
      "<p>The information and content provided on " + SITE_NAME + " are for general informational and entertainment purposes only.</p>" +
      "<h2>Game Content</h2>" +
      "<p>" + SITE_NAME + " is an independent website and is not affiliated with, endorsed by, or sponsored by RobTop Games or Robert Topala.</p>" +
      "<p>Geometry Dash and related trademarks, logos, characters, and other intellectual property belong to their respective owners. We do not claim ownership of these trademarks.</p>" +
      "<h2>Third-Party Content</h2>" +
      "<p>Our website may contain links to third-party websites or services. We are not responsible for the content, policies, availability, or practices of third-party websites.</p>" +
      "<h2>Accuracy of Information</h2>" +
      "<p>We try to keep the information on our website accurate and up to date, but we cannot guarantee that all information is complete, accurate, or current. Use the information provided on this website at your own discretion.</p>" +
      "<h2>Contact</h2>" +
      "<p>If you have any questions or concerns about this disclaimer, please contact us at:</p>" +
      "<p><a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a></p>"
  ),
];

module.exports = { pages: pages, SITE_NAME: SITE_NAME };
