<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<!-- Start the report -->
<xsl:template match="report">
<html>
<head>
<link rel="stylesheet" type="text/css" href="report.css"/>
<title><xsl:value-of select="title"/></title>
</head>
<body>
<xsl:value-of select="@date"/>
<h2><xsl:value-of select="title"/></h2>
<xsl:apply-templates select="page"/>
</body>
</html>
</xsl:template>

<!-- Next page -->
<xsl:template match="page">
<xsl:apply-templates select="header"/>
<xsl:apply-templates select="detail"/>
</xsl:template>

<!-- Header field names and values -->
<xsl:template match="header">
<p>
<xsl:for-each select="field">
<xsl:value-of select="@name"/>:
<b><xsl:value-of select="."/></b><br/>
</xsl:for-each>
</p>
</xsl:template>

<!-- Columnar values -->
<xsl:template match="detail">
<table width="650" border="1">
<xsl:apply-templates select="line[1]"/>
<xsl:for-each select="line">
<tr>
<xsl:for-each select="field">
<td><xsl:value-of select="."/></td>
</xsl:for-each>
</tr>
</xsl:for-each>
</table>
<br />
</xsl:template>

<!-- Column titles -->
<xsl:template match="line[1]">
<tr>
<xsl:for-each select="field">
<th><xsl:value-of select="@name"/></th>
</xsl:for-each>
</tr>
</xsl:template>

</xsl:stylesheet>
