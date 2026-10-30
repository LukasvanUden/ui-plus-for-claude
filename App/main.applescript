-- UI Add-on for Claude.app: opening it installs (or refreshes) the add-on and
-- offers to uninstall it. The login item opens it when a newer release exists,
-- and it then shows the update dialog instead. The work happens in
-- App/ui-addon.sh, which the build copies into the app as "UI Add-on for Claude".

property appName : "UI Add-on for Claude"
property releasesURL : "https://github.com/LukasvanUden/ui-addon-for-claude/releases/latest"

on run
	set german to (user locale of (system info)) starts with "de"
	set appPath to POSIX path of (path to me)

	-- Written by ui-addon.sh when it finds a newer release.
	set marker to POSIX path of (path to application support from user domain) & appName & "/update-available"
	set latest to ""
	try
		set latest to do shell script "/bin/cat " & quoted form of marker & " && /bin/rm -f " & quoted form of marker
	end try
	if latest is not "" then
		showUpdate(latest, german)
		return
	end if

	-- The login item runs from the app bundle, so it has to stay in Applications.
	if appPath does not contain "/Applications/" then
		if german then
			display dialog "Zieh „" & appName & "“ zuerst in den Ordner „Programme“ und öffne es dort." buttons {"OK"} default button 1 with icon caution
		else
			display dialog "Move " & appName & " to your Applications folder first, then open it there." buttons {"OK"} default button 1 with icon caution
		end if
		return
	end if

	set tool to "/bin/sh " & quoted form of (appPath & "Contents/Resources/" & appName)
	set wasInstalled to (do shell script tool & " status") is "installed"
	-- Usage Pace was this add-on's first name; installing moves its app to the Trash.
	set replacing to (do shell script "[ -d '/Applications/Usage Pace.app' ] && echo yes || echo no") is "yes"
	do shell script tool & " install"

	if replacing then
		if german then
			display dialog appName & " ersetzt jetzt Usage Pace, deine Einstellungen bleiben. Die alte App liegt im Papierkorb." & return & return & "Beende Claude einmal mit ⌘Q und öffne es wieder." buttons {"OK"} default button 1
		else
			display dialog appName & " now replaces Usage Pace and keeps your settings. The old app is in the Trash." & return & return & "Quit Claude once with ⌘Q and open it again." buttons {"OK"} default button 1
		end if
		return
	end if

	if not wasInstalled then
		if german then
			display dialog appName & " ist installiert." & return & return & "Beende Claude einmal mit ⌘Q und öffne es wieder. Das Add-on erscheint dann in der Seitenleiste und im Nutzungs-Popover." buttons {"OK"} default button 1
		else
			display dialog appName & " is installed." & return & return & "Quit Claude once with ⌘Q and open it again. The add-on then shows in the sidebar and in the usage popover." buttons {"OK"} default button 1
		end if
		return
	end if

	set current to do shell script tool & " version"
	if german then
		set choice to button returned of (display dialog appName & " " & current & " ist aktiv." buttons {"Deinstallieren", "OK"} default button "OK")
	else
		set choice to button returned of (display dialog appName & " " & current & " is active." buttons {"Uninstall", "OK"} default button "OK")
	end if
	if choice is "OK" then return

	-- Ask again; Cancel is the default and stops the script.
	if german then
		display dialog appName & " wirklich deinstallieren?" & return & return & "Das Add-on verschwindet nach dem nächsten Claude-Neustart." buttons {"Abbrechen", "Deinstallieren"} default button "Abbrechen" cancel button "Abbrechen" with icon caution
	else
		display dialog "Uninstall " & appName & "?" & return & return & "The add-on disappears the next time Claude restarts." buttons {"Cancel", "Uninstall"} default button "Cancel" cancel button "Cancel" with icon caution
	end if

	do shell script tool & " uninstall"
	if german then
		display dialog appName & " ist entfernt." & return & return & "Beende Claude einmal mit ⌘Q und öffne es wieder. Die App kannst du jetzt in den Papierkorb legen." buttons {"OK"} default button 1
	else
		display dialog appName & " is removed." & return & return & "Quit Claude once with ⌘Q and open it again. You can now move this app to the Trash." buttons {"OK"} default button 1
	end if
end run

on showUpdate(latest, german)
	if german then
		set choice to button returned of (display dialog appName & " " & latest & " ist verfügbar." & return & return & "Lade die neue Version herunter, zieh sie nach „Programme“ und öffne sie einmal." & return & return & "Per git installiert? Im Projektordner: bash Scripts/update.sh" buttons {"Später", "Herunterladen"} default button "Herunterladen")
		if choice is "Herunterladen" then open location releasesURL
	else
		set choice to button returned of (display dialog appName & " " & latest & " is available." & return & return & "Download the new version, move it to Applications and open it once." & return & return & "Installed with git? In the project folder: bash Scripts/update.sh" buttons {"Later", "Download"} default button "Download")
		if choice is "Download" then open location releasesURL
	end if
end showUpdate
