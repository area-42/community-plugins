(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["converse"], factory);
    } else {
        factory(converse);
    }
}(this, function (converse) {
    var Strophe, $iq, $msg, $pres, $build, b64_sha1, _ , dayjs, _converse, html, _, __, Model, BootstrapModal, jitsimeet_confirm, jitsimeet_invitation;
    var MeetDialog = null, meetDialog = null;

    converse.plugins.add("jitsimeet", {
        dependencies: [],

        initialize: function () {
            _converse = this._converse;

            Strophe = converse.env.Strophe;
            $iq = converse.env.$iq;
            $msg = converse.env.$msg;
            $pres = converse.env.$pres;
            $build = converse.env.$build;
            b64_sha1 = converse.env.b64_sha1;
            dayjs = converse.env.dayjs;
            html = converse.env.html;
            Model = converse.env.Model;
            BootstrapModal = converse.env.BootstrapModal;
            _ = converse.env._;
            __ = _converse.__;

            _converse.api.settings.update({
                jitsimeet_modal: false,
                jitsimeet_url: 'https://meet.jit.si',
            });

            jitsimeet_confirm  = __('Meeting?'),
            jitsimeet_invitation = __('Please join meeting in room at');

            _converse.on('message', function (data)
            {
                var chatbox = data.chatbox;
                var bodyElement = data.stanza.querySelector('body');

                if (bodyElement && _converse.shouldNotifyOfMessage(data.stanza))
                {
                    var body = bodyElement.innerHTML;
                    var url = _converse.api.settings.get("jitsimeet_url");
                    var pos = body.indexOf(url + "/");

                    if (pos > -1)
                    {
                        var room = body.substring(pos + url.length + 1);
                        var label = pos > 0 ? body.substring(0, pos) : jitsimeet_invitation;
                        var from = chatbox.getDisplayName().trim();
                        var avatar = _converse.notification_icon;

                        if (data.chatbox.vcard.attributes.image) avatar = data.chatbox.vcard.attributes.image;

                        var prompt = new Notification(from,
                        {
                            'body': label + " " + room,
                            'lang': _converse.locale,
                            'icon': avatar,
                            'requireInteraction': true
                        });

                        prompt.onclick = function(event)
                        {
                            event.preventDefault();

                            var box_jid = Strophe.getBareJidFromJid(chatbox.get("from") || chatbox.get("jid"));
                            var view = _converse.chatboxviews.get(box_jid);

                            if (view)
                            {
                                openChatbox(view);
                                doLocalVideo(view, room, url + "/" + room, label);
                            }
                        }
                    }
                }
            });

            MeetDialog = BootstrapModal.extend({
                initialize() {
                    BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.listenTo(this.model, 'change', this.render);
                },
                toHTML() {
                  var view = this.model.get("view");
                  var label = this.model.get("label");
                  var room = this.model.get("room");
                  var url = this.model.get("url");

                  return html`
                         <div class="modal-dialog modal-lg">
                             <div class="modal-content">
                                 <div class="modal-header">
                                   <h4 class="modal-title">${label} ${room}</h4>
                                 </div>
                                 <div style="text-align: center;" class="modal-body"><iframe src="${url}" id="jitsimeet" allow="microphone; camera;" frameborder="0" seamless="seamless" allowfullscreen="true" scrolling="no" style="z-index: 2147483647;width:640px;height:480px;display: inline-block"></iframe></div>
                                 <div class="modal-footer"> <button type="button" class="btn btn-danger btn-terminate" data-dismiss="modal">Close</button> </div>
                             </div>
                         </div>
                `},
                 afterRender() {
                  var that = this;

                  this.el.addEventListener('shown.bs.modal', function()
                  {
                     that.el.querySelector('.modal-body').innerHTML = '<iframe src="' + that.model.get("url") + '" id="jitsimeet" allow="microphone; camera;" frameborder="0" seamless="seamless" allowfullscreen="true" scrolling="no" style="z-index: 2147483647;width:640px;height:480px;display: inline-block"></iframe>';

                  }, false);
                },
                events: {
                    "click .btn-terminate": "terminateCall"
                },

                terminateCall() {
                    this.el.querySelector('.modal-body').innerHTML = "about:blank"
                }
            });

            _converse.api.listen.on('getToolbarButtons', function(toolbar_el, buttons)
            {
                console.debug("getToolbarButtons", toolbar_el.model.get("jid"));
                let color = "fill:var(--chat-toolbar-btn-color);";
                if (toolbar_el.model.get("type") == "chatroom") color = "fill:var(--muc-toolbar-btn-color);";

                buttons.push(html`
                    <button class="plugin-jitsimeet" title="${__('Jitsi Meet')}" @click=${performVideo} .chatview=${this.chatview}/>
                        <svg style="width:18px; height:18px; ${color}" viewBox="0 0 32 32"><path d="M22.688 14l5.313-5.313v14.625l-5.313-5.313v4.688c0 .75-.625 1.313-1.375 1.313h-16C4.563 24 4 23.437 4 22.687V9.312c0-.75.563-1.313 1.313-1.313h16c.75 0 1.375.563 1.375 1.313V14z"></path></svg>
                    </button>
                `);

                return buttons;
            });

            _converse.api.listen.on('afterMessageBodyTransformed', function(model, text)
            {
                const body = model.get("body");

                if (body)
                {
                    const pos = body.indexOf("https://");

                    if (pos > -1 && body.indexOf(_converse.api.settings.get("jitsimeet_url")) > -1)
                    {
                        console.debug("afterMessageBodyTransformed", body, text);

                        const url = body.substring(pos);
                        const link_jid = Strophe.getBareJidFromJid(model.get("from") || model.get("jid"));
                        const link_room = url.substring(url.lastIndexOf("/") + 1);
                        const link_label = jitsimeet_invitation;
                        const link_id = link_room + "-" + Math.random().toString(36).substr(2,9);

                        text.references = [];
                        text.addTemplateResult(0, body.length, html`<a @click=${clickVideo} data-room="${link_room}" data-url="${url}" data-jid="${link_jid}" id="${link_id}" href="#">${link_label} ${link_room}</a>`);
                    }
                }
            });

            console.debug("jitsimeet plugin is ready");
        }
    });

    function performVideo(ev)
    {
        ev.stopPropagation();
        ev.preventDefault();

        if (confirm(jitsimeet_confirm))
        {
            doVideo(this.chatview);
        }
    }

    function clickVideo(ev)
    {
        ev.stopPropagation();
        ev.preventDefault();

        var url = ev.target.getAttribute("data-url");
        var room = ev.target.getAttribute("data-room");
        var jid = ev.target.getAttribute("data-jid");
        var view = _converse.chatboxviews.get(jid);

        if (view) doLocalVideo(view, room, url, jitsimeet_invitation);
    }

    var doVideo = function doVideo(view)
    {
        const room = Strophe.getNodeFromJid(view.model.attributes.jid).toLowerCase() + "-" + Math.random().toString(36).substr(2,9);
        const url = _converse.api.settings.get("jitsimeet_url") + '/' + room;

        console.debug("doVideo", room, url, view);

        const label = jitsimeet_invitation;
        const attrs = view.model.getOutgoingMessageAttributes(url);
        const message = view.model.messages.create(attrs);
        message.set('oob_url', url);

        _converse.api.send(view.model.createMessageStanza(message));
        doLocalVideo(view, room, url, label);
    }

    var doLocalVideo = function doLocalVideo(view, room, url, label)
    {
        console.debug("doLocalVideo", view, room, url, label);

        var modal = _converse.api.settings.get("jitsimeet_modal") == true;

        if (modal)
        {
            if (!meetDialog) meetDialog = new MeetDialog({'model': new converse.env.Model({})});
            meetDialog.model.set("view", view);
            meetDialog.model.set("url", url);
            meetDialog.model.set("label", label);
            meetDialog.model.set("room", room);
            meetDialog.show();
        }
        else {

            var div = view.el.querySelector(".box-flyout");

            if (div)
            {
                div.innerHTML = '<iframe src="' + url + '" id="jitsimeet" allow="microphone; camera;" frameborder="0" seamless="seamless" allowfullscreen="true" scrolling="no" style="z-index: 2147483647;width:100%;height:-webkit-fill-available;height:-moz-available;"></iframe>';

                var jitsiDiv = div.querySelector('#jitsimeet');
                var firstTime = true;

                jitsiDiv.addEventListener("load", function ()
                {
                    console.debug("doVideo - load", this);

                    if (!firstTime) // meeting closed and root url is loaded
                    {
                        view.close();
                        openChatbox(view);
                    }

                    if (firstTime) firstTime = false;   // ignore when jitsi-meet room url is loaded

                });
            }
        }
    }

    var openChatbox = function openChatbox(view)
    {
        let jid = view.model.get("jid");
        let type = view.model.get("type");

        if (jid)
        {
            view.close();

            if (type == "chatbox") _converse.api.chats.open(jid, {'bring_to_foreground': true}, true);
            else
            if (type == "chatroom") _converse.api.rooms.open(jid, {'bring_to_foreground': true}, true);
        }
    }
}));
