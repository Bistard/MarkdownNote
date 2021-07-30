# MarkdownNote
An open-sourced markdown editor && noteTaking desktop application based on .md
(still in progress)

# expect feature
* supports WYSIWYG (rich text), instant rendering, tranditional split view editing
* supports git and github
* provides great noteTaking-like user experience
# next
* tabView
  * functionalities
  * show tab on markdownView
* folderView
  * filter folders by config
# to do
* [ ] ⭐theme
  * [ ] dynamically change .svg color
* [x] ⭐titleBarView
  * [x] ~~bug: cannot remove menu properly~~
  * [x] icon
    * [x] switch mask-image to sth else
    * [x] maxBtn
      * [x] maxBtn switch to restoreBtn
      * [ ] holding onclick can change to mode 'always on top'
  * [ ] more
* [x] ⭐folderView
  * [x] interactive size
    * [x] middle three point button style
  * [x] folder tree view
    * [x] open empty folder dialog
    * [x] display current working directory
    * [x] functionality 
      * [x] new UI
        * [x] folder indent line
      * [x] scrollable
      * [x] indent
      * [x] node functionality
        * [x] expand
        * [x] collapse
        * [ ] focus
        * [ ] manual move order
  * [ ] functionality
    * [ ] expandALL/collapseALL
    * [ ] filter folders/files
    * [ ] right-click
    * [ ] config
      * [ ] directory config with local save
* [x] ⭐markdownView
  * [x] vditor preview
  * [ ] vditor needs to be rendered before window created (not sure if still necessary)
  * [x] open and render a .md file (by inserting plainText)
  * [x] tool bar
    * [x] remove default tool bar
* [x] ⭐tabView
  * [x] UI
    * [ ] good design - https://freefrontend.com/css-tab-bars/
    * [x] horizontal scroll
      * [ ] more fluent animation
      * [ ] use middle mouse to scroll
    * [x] color
  * [x] basic functionality
    * [ ] right lick menu
    * [ ] change order
    * [x] close tab
    * [ ] shortcut
    * [ ] empty click create temp file
* [ ] ⭐gitView
  * [ ] functionality
    * [ ] .git
  * [ ] timeline view
* [x] ⭐Others
  * [x] preload.js
  * [ ] remove using document.getElementById() instead using JQuery (maybe? check performance)
    * [x] error: winMian is not found
  * [ ] reduce frequency of using document.getElementById()
  * [x] using classes
  * [X] Settings (Config)
    * [ ] UI config
  * [ ] get used of 'github issue'

# bugs
* [x] disabled vditor cache will displays some weird text
* [ ] (debug state) since opening file is essentially inserting text, we need to clean history immediately
* [x] fix - folderView.js - remove emptyFolderTag correctly
# ChangeLog
* ⭐ => 'big update'
* 💙 => 'debug'
* 💛 => 'unstable'
* 💚 => 'stable'
* 🧡 => 'bug found'
* 🖤 => 'bug fix'
* 🤍 => 'others'
